// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SlyceBase} from "./SlyceBase.sol";

interface ISlycePrizePool {
    function ensurePrizeTournament() external returns (uint256);
    function creditFromArcade(uint128 amount) external returns (uint256);
}

/// @title Slyce Arcade (UUPS)
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
    }

    // keccak256(abi.encode(uint256(keccak256("slyce.storage.Arcade")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 internal constant ARCADE_STORAGE = 0xfd93fbf6039acd2f20dc416f9ef73044e88c544a37460c38ff106e9c39f9cc00;

    uint256 public constant MAX_PLAY_FEE = 100 ether;

    event PlayFeeChanged(uint128 playFee);
    /// @param round Global round number, unique per paid round.
    /// @param prizeTournament Tournament whose pool received the fee, or 0 if it went to the treasury.
    event RoundPaid(address indexed player, uint64 indexed round, uint64 playerRound, uint128 fee, uint256 prizeTournament);
    event PrizePoolChanged(address indexed prizePool);

    error InvalidFee();
    error FeeAboveLimit(uint256 fee, uint256 maxFee);

    function initialize(IERC20 token_, address treasury_, address owner_, uint128 playFee_) external initializer {
        __SlyceBase_init(token_, treasury_, owner_);
        _setPlayFee(playFee_);
    }

    function version() external pure virtual returns (string memory) {
        return "1.3.0";
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
