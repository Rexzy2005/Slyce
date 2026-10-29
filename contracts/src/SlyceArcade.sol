// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SlyceBase} from "./SlyceBase.sol";

/// @notice GoodDollar Identity: verified root identity of an account (zero if not a verified human).
interface IVerifiedHumans {
    function getWhitelistedRoot(address account) external view returns (address);
}

interface ISlycePrizePool {
    function ensurePrizeTournament() external returns (uint256);
    function creditFromArcade(uint128 amount) external returns (uint256);
}

/// @title Slyce Arcade (UUPS)
/// @notice v2: free-to-play game records. `submitGame` stores each finished round on-chain, grows the player's XP,
/// best score and daily streak, and pays G$ milestone rewards from a funded pot to GoodDollar-verified humans
/// (each milestone at most once per day per human). The legacy paid `play` path remains for compatibility.
/// @notice Charges the G$ play fee that starts a round. While a prize tournament is open the fee grows its
/// prize pool (players compete for it); otherwise it goes to the treasury. The app only starts a round after
/// this transaction confirms.
contract SlyceArcade is SlyceBase {
    /// @custom:storage-location erc7201:slyce.storage.Arcade
    struct ArcadeStorage {
        uint128 playFee;
        uint64 totalRounds;
        mapping(address player => uint64) roundsPlayed;
        ISlycePrizePool prizePool; // SlyceTournament; zero disables fee routing
        // ----- v2 (appended) -----
        IVerifiedHumans identity; // GoodDollar Identity; milestone G$ only for verified humans
        uint32 maxScore; // sanity cap per game; 0 = games not accepted yet
        uint32 minInterval; // seconds between a player's submissions
        uint64 totalGames;
        uint128 rewardBudget; // G$ held for milestone rewards
        uint128 totalRewardsPaid;
        Milestone[] milestones; // ascending by score
        mapping(address player => PlayerStats) stats;
        mapping(address root => mapping(uint256 milestone => uint32 dayPlusOne)) rewarded;
    }

    struct Milestone {
        uint32 score;
        uint128 reward;
    }

    struct PlayerStats {
        uint64 xp;
        uint32 bestScore;
        uint32 games;
        uint32 streak; // consecutive UTC days with a recorded game
        uint32 lastDay;
        uint64 lastSubmit;
        uint128 earned; // G$ milestone rewards received
    }

    // keccak256(abi.encode(uint256(keccak256("slyce.storage.Arcade")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 internal constant ARCADE_STORAGE = 0xfd93fbf6039acd2f20dc416f9ef73044e88c544a37460c38ff106e9c39f9cc00;

    uint256 public constant MAX_PLAY_FEE = 100 ether;
    uint256 public constant MAX_MILESTONES = 8;
    uint256 public constant MAX_MILESTONE_REWARD = 1000 ether;
    uint32 public constant XP_DIVISOR = 10; // 1 XP per 10 points

    event PlayFeeChanged(uint128 playFee);
    /// @param round Global round number, unique per paid round.
    /// @param prizeTournament Tournament whose pool received the fee, or 0 if it went to the treasury.
    event RoundPaid(address indexed player, uint64 indexed round, uint64 playerRound, uint128 fee, uint256 prizeTournament);
    event PrizePoolChanged(address indexed prizePool);
    event GameRecorded(address indexed player, uint64 indexed gameId, uint32 score, uint32 bestCombo, uint32 fruits, uint64 xpGained);
    event MilestoneRewarded(address indexed player, uint64 indexed gameId, uint32 milestoneScore, uint128 reward);
    event MilestoneSkippedUnfunded(address indexed player, uint64 indexed gameId, uint32 milestoneScore, uint128 reward);
    event RewardsFunded(address indexed funder, uint128 amount);
    event RewardsWithdrawn(address indexed to, uint128 amount);
    event MilestonesChanged();
    event GameRulesChanged(uint32 maxScore, uint32 minInterval);
    event IdentityChanged(address indexed identity);

    error InvalidFee();
    error FeeAboveLimit(uint256 fee, uint256 maxFee);
    error GamesClosed();
    error InvalidScore();
    error TooSoon(uint64 nextAllowed);
    error InvalidMilestones();
    error InsufficientBudget(uint256 amount, uint256 budget);

    function initialize(IERC20 token_, address treasury_, address owner_, uint128 playFee_) external initializer {
        __SlyceBase_init(token_, treasury_, owner_);
        _setPlayFee(playFee_);
    }

    function version() external pure virtual returns (string memory) {
        return "2.0.0";
    }

    function playFee() external view returns (uint128) {
        return _arcade().playFee;
    }

    function totalRounds() external view returns (uint64) {
        return _arcade().totalRounds;
    }

    function roundsPlayed(address player) external view returns (uint64) {
        return _arcade().roundsPlayed[player];
    }

    function prizePool() external view returns (address) {
        return address(_arcade().prizePool);
    }

    // ----- v2 views -----

    function identity() external view returns (address) {
        return address(_arcade().identity);
    }

    function gameRules() external view returns (uint32 maxScore, uint32 minInterval) {
        ArcadeStorage storage $ = _arcade();
        return ($.maxScore, $.minInterval);
    }

    function totalGames() external view returns (uint64) {
        return _arcade().totalGames;
    }

    function rewardBudget() external view returns (uint128) {
        return _arcade().rewardBudget;
    }

    function totalRewardsPaid() external view returns (uint128) {
        return _arcade().totalRewardsPaid;
    }

    function milestones() external view returns (Milestone[] memory) {
        return _arcade().milestones;
    }

    function playerStats(address player) external view returns (PlayerStats memory) {
        return _arcade().stats[player];
    }

    /// @notice Milestone indexes this human has already been rewarded for today (bit i = milestone i).
    function rewardedToday(address player) external view returns (uint256 mask) {
        ArcadeStorage storage $ = _arcade();
        if (address($.identity) == address(0)) return 0;
        address root = $.identity.getWhitelistedRoot(player);
        if (root == address(0)) return 0;
        uint32 today = uint32(block.timestamp / 1 days) + 1;
        for (uint256 i; i < $.milestones.length; i++) {
            if ($.rewarded[root][i] == today) mask |= 1 << i;
        }
    }

    // ----- v2 owner -----

    function setIdentity(address identity_) external onlyOwner {
        _arcade().identity = IVerifiedHumans(identity_);
        emit IdentityChanged(identity_);
    }

    function setGameRules(uint32 maxScore_, uint32 minInterval_) external onlyOwner {
        ArcadeStorage storage $ = _arcade();
        $.maxScore = maxScore_;
        $.minInterval = minInterval_;
        emit GameRulesChanged(maxScore_, minInterval_);
    }

    /// @notice Replaces the milestone table. Scores strictly ascending; rewards bounded.
    function setMilestones(uint32[] calldata scores, uint128[] calldata rewards) external onlyOwner {
        if (scores.length != rewards.length || scores.length > MAX_MILESTONES) revert InvalidMilestones();
        ArcadeStorage storage $ = _arcade();
        delete $.milestones;
        for (uint256 i; i < scores.length; i++) {
            if (scores[i] == 0 || (i > 0 && scores[i] <= scores[i - 1]) || rewards[i] > MAX_MILESTONE_REWARD) {
                revert InvalidMilestones();
            }
            $.milestones.push(Milestone(scores[i], rewards[i]));
        }
        emit MilestonesChanged();
    }

    function withdrawRewards(address to, uint128 amount) external onlyOwner nonReentrant {
        ArcadeStorage storage $ = _arcade();
        if (to == address(0)) revert ZeroAddress();
        if (amount > $.rewardBudget) revert InsufficientBudget(amount, $.rewardBudget);
        $.rewardBudget -= amount;
        emit RewardsWithdrawn(to, amount);
        _push(to, amount);
    }

    // ----- v2 players -----

    /// @notice Anyone (the team, sponsors) can add G$ to the milestone reward pot.
    function fundRewards(uint128 amount) external nonReentrant {
        if (amount == 0) revert InvalidFee();
        _arcade().rewardBudget += amount;
        emit RewardsFunded(msg.sender, amount);
        _pull(msg.sender, address(this), amount);
    }

    /// @notice Records a finished free-to-play round and pays any milestone G$ the player earned today.
    /// Scores are reported by the client: rewards are limited to verified humans, once per milestone per day.
    function submitGame(uint32 score, uint32 bestCombo, uint32 fruits) external whenNotPaused nonReentrant returns (uint64 gameId) {
        ArcadeStorage storage $ = _arcade();
        if ($.maxScore == 0) revert GamesClosed();
        if (score > $.maxScore) revert InvalidScore();
        PlayerStats storage s = $.stats[msg.sender];
        uint64 nextAllowed = s.lastSubmit + $.minInterval;
        if (s.games != 0 && block.timestamp < nextAllowed) revert TooSoon(nextAllowed);

        uint32 today = uint32(block.timestamp / 1 days);
        if (s.games == 0 || today > s.lastDay + 1) s.streak = 1;
        else if (today == s.lastDay + 1) s.streak += 1;
        s.lastDay = today;
        s.lastSubmit = uint64(block.timestamp);
        s.games += 1;
        uint64 xpGained = score / XP_DIVISOR;
        s.xp += xpGained;
        if (score > s.bestScore) s.bestScore = score;
        gameId = ++$.totalGames;
        emit GameRecorded(msg.sender, gameId, score, bestCombo, fruits, xpGained);

        // Keep bounties running: start the next one if the last ended.
        ISlycePrizePool pool = $.prizePool;
        if (address(pool) != address(0)) pool.ensurePrizeTournament();

        uint128 payout = _milestoneRewards($, msg.sender, gameId, score, today);
        if (payout != 0) {
            s.earned += payout;
            $.totalRewardsPaid += payout;
            _push(msg.sender, payout);
        }
    }

    function _milestoneRewards(ArcadeStorage storage $, address player, uint64 gameId, uint32 score, uint32 today)
        private
        returns (uint128 payout)
    {
        uint256 count = $.milestones.length;
        if (count == 0 || address($.identity) == address(0) || score < $.milestones[0].score) return 0;
        address root = $.identity.getWhitelistedRoot(player);
        if (root == address(0)) return 0;
        uint32 mark = today + 1;
        for (uint256 i; i < count; i++) {
            Milestone memory m = $.milestones[i];
            if (score < m.score) break;
            if ($.rewarded[root][i] == mark) continue;
            if (m.reward > $.rewardBudget) {
                emit MilestoneSkippedUnfunded(player, gameId, m.score, m.reward);
                continue;
            }
            $.rewarded[root][i] = mark;
            $.rewardBudget -= m.reward;
            payout += m.reward;
            emit MilestoneRewarded(player, gameId, m.score, m.reward);
        }
    }

    function setPlayFee(uint128 playFee_) external onlyOwner {
        _setPlayFee(playFee_);
    }

    function setPrizePool(address prizePool_) external onlyOwner {
        _arcade().prizePool = ISlycePrizePool(prizePool_);
        emit PrizePoolChanged(prizePool_);
    }

    /// @param maxFee Protects the player if the fee changes after the UI displayed it.
    function play(uint256 maxFee) external whenNotPaused nonReentrant returns (uint64 round) {
        ArcadeStorage storage $ = _arcade();
        uint128 fee = $.playFee;
        if (fee > maxFee) revert FeeAboveLimit(fee, maxFee);
        round = ++$.totalRounds;
        uint64 playerRound = ++$.roundsPlayed[msg.sender];
        ISlycePrizePool pool = $.prizePool;
        // Starts the next automatic tournament if the last one ended, so the pool never sits closed.
        uint256 prizeId = fee != 0 && address(pool) != address(0) ? pool.ensurePrizeTournament() : 0;
        emit RoundPaid(msg.sender, round, playerRound, fee, prizeId);
        if (fee == 0) return round;
        if (prizeId != 0) {
            _pull(msg.sender, address(pool), fee);
            pool.creditFromArcade(fee);
        } else {
            _pull(msg.sender, treasury(), fee);
        }
    }

    function _setPlayFee(uint128 playFee_) private {
        if (playFee_ > MAX_PLAY_FEE) revert InvalidFee();
        _arcade().playFee = playFee_;
        emit PlayFeeChanged(playFee_);
    }

    function _arcade() private pure returns (ArcadeStorage storage $) {
        assembly {
            $.slot := ARCADE_STORAGE
        }
    }
}
