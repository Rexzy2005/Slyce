// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SlyceBase} from "./SlyceBase.sol";

/// @title Slyce Arcade (UUPS)
/// @notice Charges the G$ play fee that starts a round. The fee goes straight to the treasury.
/// The app only starts a round after this transaction confirms.
contract SlyceArcade is SlyceBase {
    /// @custom:storage-location erc7201:slyce.storage.Arcade
    struct ArcadeStorage {
        uint128 playFee;
        uint64 totalRounds;
        mapping(address player => uint64) roundsPlayed;
    }

    // keccak256(abi.encode(uint256(keccak256("slyce.storage.Arcade")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 internal constant ARCADE_STORAGE = 0xfd93fbf6039acd2f20dc416f9ef73044e88c544a37460c38ff106e9c39f9cc00;

    uint256 public constant MAX_PLAY_FEE = 100 ether;

    event PlayFeeChanged(uint128 playFee);
    /// @param round Global round number, unique per paid round.
    event RoundPaid(address indexed player, uint64 indexed round, uint64 playerRound, uint128 fee);

    error InvalidFee();
    error FeeAboveLimit(uint256 fee, uint256 maxFee);

    function initialize(IERC20 token_, address treasury_, address owner_, uint128 playFee_) external initializer {
        __SlyceBase_init(token_, treasury_, owner_);
        _setPlayFee(playFee_);
    }

    function version() external pure virtual returns (string memory) {
        return "1.1.0";
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

    function setPlayFee(uint128 playFee_) external onlyOwner {
        _setPlayFee(playFee_);
    }

    /// @param maxFee Protects the player if the fee changes after the UI displayed it.
    function play(uint256 maxFee) external whenNotPaused nonReentrant returns (uint64 round) {
        ArcadeStorage storage $ = _arcade();
        uint128 fee = $.playFee;
        if (fee > maxFee) revert FeeAboveLimit(fee, maxFee);
        round = ++$.totalRounds;
        uint64 playerRound = ++$.roundsPlayed[msg.sender];
        emit RoundPaid(msg.sender, round, playerRound, fee);
        if (fee != 0) _pull(msg.sender, treasury(), fee);
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
