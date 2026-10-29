// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {SlyceBase} from "./SlyceBase.sol";

/// @notice GoodDollar Identity: returns the verified root identity of an account (zero if not a verified human).
interface IGoodDollarIdentity {
    function getWhitelistedRoot(address account) external view returns (address);
}

/// @title Slyce Tournament (UUPS)
/// @notice Holds G$ entry fees and sponsorships per tournament. Entrants submit self-reported scores; after
/// the end the owner (operator) posts a Merkle root of prizes and winners claim with a proof. The contract
/// does not verify scores. A cancelled tournament refunds every entrant and sponsor in full.
/// @dev Invariant: token.balanceOf(this) >= liabilities. Claims and refunds stay available while paused.
contract SlyceTournament is SlyceBase {
    using SafeERC20 for IERC20;

    struct Tournament {
        uint64 startTime;
        uint64 endTime;
        uint64 resultsPostedAt;
        uint32 entrants;
        uint32 maxEntrants; // 0 = unlimited
        bool cancelled;
        uint128 entryFee;
        uint128 pool; // entry fees + sponsorships still attributed to this tournament
        uint128 payoutTotal; // sum of all prize leaves in the results root
        uint128 claimed;
        bytes32 resultsRoot;
    }

    /// @custom:storage-location erc7201:slyce.storage.Tournament
    struct TournamentStorage {
        uint256 count;
        uint256 liabilities; // G$ owed to players/sponsors across all tournaments
        mapping(uint256 id => Tournament) tournaments;
        mapping(uint256 id => mapping(address player => bool)) entered;
        mapping(uint256 id => mapping(address player => bool)) prizeClaimed;
        mapping(uint256 id => mapping(address player => uint32)) bestScore;
        mapping(uint256 id => mapping(address sponsor => uint128)) sponsored;
        mapping(uint256 id => mapping(address account => bool)) refunded;
        address arcade; // the only contract allowed to add play fees to a prize pool
        uint256 prizeTournament; // tournament whose pool receives play fees while it is open
        IGoodDollarIdentity identity; // when set, only GoodDollar-verified humans may enter, once per human
        mapping(uint256 id => mapping(address root => bool)) rootEntered;
    }

    // keccak256(abi.encode(uint256(keccak256("slyce.storage.Tournament")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 internal constant TOURNAMENT_STORAGE = 0x79852a01ef4468fa252df3d6cc3ad19dfedcf1ddaa35b35037e1d4ab6d079700;

    uint256 public constant CLAIM_WINDOW = 30 days;
    uint256 public constant MIN_DURATION = 10 minutes;
    uint256 public constant MAX_DURATION = 31 days;
    uint256 public constant MAX_ENTRY_FEE = 10_000 ether;
    uint256 public constant MAX_SPONSORSHIP = 1_000_000 ether;
    uint32 public constant MAX_SCORE = 10_000_000;

    event TournamentCreated(uint256 indexed id, uint64 startTime, uint64 endTime, uint128 entryFee, uint32 maxEntrants);
    event Entered(uint256 indexed id, address indexed player, uint128 fee);
    event Sponsored(uint256 indexed id, address indexed sponsor, uint128 amount);
    event ScoreSubmitted(uint256 indexed id, address indexed player, uint32 score);
    event ResultsPosted(uint256 indexed id, bytes32 root, uint128 payoutTotal, uint128 remainder);
    event PrizeClaimed(uint256 indexed id, address indexed player, uint128 amount);
    event UnclaimedSwept(uint256 indexed id, uint128 amount);
    event TournamentCancelled(uint256 indexed id);
    event Refunded(uint256 indexed id, address indexed account, uint128 amount);
    event Rescued(address indexed token, address indexed to, uint256 amount);
    event ArcadeChanged(address indexed arcade);
    event PrizeTournamentChanged(uint256 indexed id);
    /// @notice Play fees routed into a prize pool by the arcade. Recorded as treasury sponsorship (refundable on cancel).
    event PoolFundedByPlay(uint256 indexed id, uint128 amount);
    event IdentityChanged(address indexed identity);

    error InvalidSchedule();
    error InvalidFee();
    error UnknownTournament(uint256 id);
    error NotOpen(uint256 id);
    error AlreadyEntered(uint256 id);
    error NotEntered(uint256 id);
    error TournamentFull(uint256 id);
    error NotEnded(uint256 id);
    error ResultsAlreadyPosted(uint256 id);
    error ResultsNotPosted(uint256 id);
    error PayoutExceedsPool(uint256 payout, uint256 pool);
    error AlreadyClaimed(uint256 id);
    error InvalidProof();
    error ClaimWindowOpen(uint256 id);
    error InvalidAmount();
    error InvalidScore();
    error Cancelled(uint256 id);
    error NotCancelled(uint256 id);
    error NothingToRefund(uint256 id);
    error ExceedsSurplus(uint256 amount, uint256 surplus);
    error NotArcade();
    error NoOpenPrizeTournament();
    error NotVerifiedHuman();
    error HumanAlreadyEntered(uint256 id, address root);

    function initialize(IERC20 token_, address treasury_, address owner_) external initializer {
        __SlyceBase_init(token_, treasury_, owner_);
    }

    function version() external pure virtual returns (string memory) {
        return "1.2.0";
    }

    // ----- Views -----

    function tournamentCount() external view returns (uint256) {
        return _store().count;
    }

    function liabilities() external view returns (uint256) {
        return _store().liabilities;
    }

    function getTournament(uint256 id) external view returns (Tournament memory) {
        return _store().tournaments[id];
    }

    function entered(uint256 id, address player) external view returns (bool) {
        return _store().entered[id][player];
    }

    function prizeClaimed(uint256 id, address player) external view returns (bool) {
        return _store().prizeClaimed[id][player];
    }

    function bestScore(uint256 id, address player) external view returns (uint32) {
        return _store().bestScore[id][player];
    }

    function sponsored(uint256 id, address sponsor_) external view returns (uint128) {
        return _store().sponsored[id][sponsor_];
    }

    function refunded(uint256 id, address account) external view returns (bool) {
        return _store().refunded[id][account];
    }

    function identity() external view returns (address) {
        return address(_store().identity);
    }

    function arcade() external view returns (address) {
        return _store().arcade;
    }

    function prizeTournament() external view returns (uint256) {
        return _store().prizeTournament;
    }

    /// @notice The prize tournament id if it is currently open (accepting entries and play fees), else 0.
    function openPrizeTournament() public view returns (uint256) {
        TournamentStorage storage $ = _store();
        uint256 id = $.prizeTournament;
        if (id == 0) return 0;
        Tournament storage t = $.tournaments[id];
        if (t.cancelled || t.resultsRoot != bytes32(0) || block.timestamp < t.startTime || block.timestamp >= t.endTime) return 0;
        return id;
    }

    // ----- Owner -----

    /// @notice GoodDollar Identity contract (zero disables the verified-human requirement).
    function setIdentity(address identity_) external onlyOwner {
        _store().identity = IGoodDollarIdentity(identity_);
        emit IdentityChanged(identity_);
    }

    function setArcade(address arcade_) external onlyOwner {
        _store().arcade = arcade_;
        emit ArcadeChanged(arcade_);
    }

    /// @notice Selects the tournament (usually today's) whose pool grows with every paid round. 0 disables routing.
    function setPrizeTournament(uint256 id) external onlyOwner {
        if (id != 0) {
            Tournament storage t = _existing(id);
            if (t.cancelled) revert Cancelled(id);
        }
        _store().prizeTournament = id;
        emit PrizeTournamentChanged(id);
    }

    // ----- Arcade -----

    /// @notice Called by the arcade after it transferred `amount` G$ here from a player's play fee.
    function creditFromArcade(uint128 amount) external nonReentrant returns (uint256 id) {
        TournamentStorage storage $ = _store();
        if (msg.sender != $.arcade || msg.sender == address(0)) revert NotArcade();
        id = openPrizeTournament();
        if (id == 0) revert NoOpenPrizeTournament();
        if (amount == 0) revert InvalidAmount();
        Tournament storage t = $.tournaments[id];
        t.pool += amount;
        $.liabilities += amount;
        $.sponsored[id][treasury()] += amount;
        emit PoolFundedByPlay(id, amount);
    }

    function createTournament(uint64 startTime, uint64 endTime, uint128 entryFee, uint32 maxEntrants)
        external
        onlyOwner
        returns (uint256 id)
    {
        if (startTime < block.timestamp || endTime <= startTime) revert InvalidSchedule();
        uint256 duration = endTime - startTime;
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert InvalidSchedule();
        if (entryFee > MAX_ENTRY_FEE) revert InvalidFee();
        TournamentStorage storage $ = _store();
        id = ++$.count;
        Tournament storage t = $.tournaments[id];
        t.startTime = startTime;
        t.endTime = endTime;
        t.entryFee = entryFee;
        t.maxEntrants = maxEntrants;
        emit TournamentCreated(id, startTime, endTime, entryFee, maxEntrants);
    }

    /// @notice Leaves are keccak256(bytes.concat(keccak256(abi.encode(id, player, amount)))).
    /// Any pool not allocated to prizes goes to the treasury.
    function postResults(uint256 id, bytes32 root, uint128 payoutTotal) external onlyOwner nonReentrant {
        TournamentStorage storage $ = _store();
        Tournament storage t = _existing(id);
        if (t.cancelled) revert Cancelled(id);
        if (block.timestamp < t.endTime) revert NotEnded(id);
        if (t.resultsRoot != bytes32(0)) revert ResultsAlreadyPosted(id);
        if (root == bytes32(0)) revert InvalidProof();
        if (payoutTotal == 0 || payoutTotal > t.pool) revert PayoutExceedsPool(payoutTotal, t.pool);
        t.resultsRoot = root;
        t.payoutTotal = payoutTotal;
        t.resultsPostedAt = uint64(block.timestamp);
        uint128 remainder = t.pool - payoutTotal;
        $.liabilities -= remainder;
        emit ResultsPosted(id, root, payoutTotal, remainder);
        if (remainder != 0) _push(treasury(), remainder);
    }

    /// @notice Cancels a tournament before results; every entrant and sponsor can then call `refund`.
    function cancelTournament(uint256 id) external onlyOwner {
        Tournament storage t = _existing(id);
        if (t.cancelled) revert Cancelled(id);
        if (t.resultsRoot != bytes32(0)) revert ResultsAlreadyPosted(id);
        t.cancelled = true;
        emit TournamentCancelled(id);
    }

    /// @notice After the claim window, unclaimed prizes return to the treasury.
    function sweepUnclaimed(uint256 id) external onlyOwner nonReentrant {
        TournamentStorage storage $ = _store();
        Tournament storage t = _existing(id);
        if (t.resultsRoot == bytes32(0)) revert ResultsNotPosted(id);
        if (block.timestamp < t.resultsPostedAt + CLAIM_WINDOW) revert ClaimWindowOpen(id);
        uint128 amount = t.payoutTotal - t.claimed;
        t.claimed = t.payoutTotal;
        $.liabilities -= amount;
        emit UnclaimedSwept(id, amount);
        if (amount != 0) _push(treasury(), amount);
    }

    /// @notice Recovers tokens sent here by mistake. G$ owed to players can never be withdrawn.
    function rescue(IERC20 asset, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (address(asset) == address(token())) {
            uint256 surplus = asset.balanceOf(address(this)) - _store().liabilities;
            if (amount > surplus) revert ExceedsSurplus(amount, surplus);
        }
        emit Rescued(address(asset), to, amount);
        asset.safeTransfer(to, amount);
    }

    // ----- Players -----

    function enter(uint256 id) external whenNotPaused nonReentrant {
        TournamentStorage storage $ = _store();
        Tournament storage t = _open(id);
        if ($.entered[id][msg.sender]) revert AlreadyEntered(id);
        if (t.maxEntrants != 0 && t.entrants >= t.maxEntrants) revert TournamentFull(id);
        IGoodDollarIdentity gate = $.identity;
        if (address(gate) != address(0)) {
            // Prizes go to verified unique humans: one entry per GoodDollar identity, even across linked wallets.
            address root = gate.getWhitelistedRoot(msg.sender);
            if (root == address(0)) revert NotVerifiedHuman();
            if ($.rootEntered[id][root]) revert HumanAlreadyEntered(id, root);
            $.rootEntered[id][root] = true;
        }
        $.entered[id][msg.sender] = true;
        t.entrants += 1;
        t.pool += t.entryFee;
        $.liabilities += t.entryFee;
        emit Entered(id, msg.sender, t.entryFee);
        if (t.entryFee != 0) _pull(msg.sender, address(this), t.entryFee);
    }

    /// @notice Anyone may add G$ to a prize pool before it ends.
    function sponsor(uint256 id, uint128 amount) external whenNotPaused nonReentrant {
        TournamentStorage storage $ = _store();
        Tournament storage t = _existing(id);
        if (t.cancelled) revert Cancelled(id);
        if (block.timestamp >= t.endTime) revert NotOpen(id);
        if (amount == 0 || amount > MAX_SPONSORSHIP) revert InvalidAmount();
        $.sponsored[id][msg.sender] += amount;
        t.pool += amount;
        $.liabilities += amount;
        emit Sponsored(id, msg.sender, amount);
        _pull(msg.sender, address(this), amount);
    }

    /// @notice Self-reported score while the tournament is open. Only improvements are kept.
    function submitScore(uint256 id, uint32 score) external whenNotPaused {
        TournamentStorage storage $ = _store();
        _open(id);
        if (!$.entered[id][msg.sender]) revert NotEntered(id);
        if (score == 0 || score > MAX_SCORE || score <= $.bestScore[id][msg.sender]) revert InvalidScore();
        $.bestScore[id][msg.sender] = score;
        emit ScoreSubmitted(id, msg.sender, score);
    }

    function claim(uint256 id, uint128 amount, bytes32[] calldata proof) external nonReentrant {
        TournamentStorage storage $ = _store();
        Tournament storage t = _existing(id);
        if (t.resultsRoot == bytes32(0)) revert ResultsNotPosted(id);
        if ($.prizeClaimed[id][msg.sender]) revert AlreadyClaimed(id);
        if (amount == 0) revert InvalidAmount();
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(id, msg.sender, amount))));
        if (!MerkleProof.verifyCalldata(proof, t.resultsRoot, leaf)) revert InvalidProof();
        if (t.claimed + amount > t.payoutTotal) revert PayoutExceedsPool(t.claimed + amount, t.payoutTotal);
        $.prizeClaimed[id][msg.sender] = true;
        t.claimed += amount;
        $.liabilities -= amount;
        emit PrizeClaimed(id, msg.sender, amount);
        _push(msg.sender, amount);
    }

    /// @notice Returns the caller's entry fee and sponsorship for a cancelled tournament.
    function refund(uint256 id) external nonReentrant {
        TournamentStorage storage $ = _store();
        Tournament storage t = _existing(id);
        if (!t.cancelled) revert NotCancelled(id);
        if ($.refunded[id][msg.sender]) revert NothingToRefund(id);
        uint128 amount = $.sponsored[id][msg.sender] + ($.entered[id][msg.sender] ? t.entryFee : 0);
        if (amount == 0) revert NothingToRefund(id);
        $.refunded[id][msg.sender] = true;
        t.pool -= amount;
        $.liabilities -= amount;
        emit Refunded(id, msg.sender, amount);
        _push(msg.sender, amount);
    }

    // ----- Internal -----

    function _existing(uint256 id) private view returns (Tournament storage t) {
        TournamentStorage storage $ = _store();
        if (id == 0 || id > $.count) revert UnknownTournament(id);
        return $.tournaments[id];
    }

    function _open(uint256 id) private view returns (Tournament storage t) {
        t = _existing(id);
        if (t.cancelled) revert Cancelled(id);
        if (block.timestamp < t.startTime || block.timestamp >= t.endTime) revert NotOpen(id);
    }

    function _store() private pure returns (TournamentStorage storage $) {
        assembly {
            $.slot := TOURNAMENT_STORAGE
        }
    }
}
