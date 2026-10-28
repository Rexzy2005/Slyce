// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/// @title Slyce shared base
/// @notice UUPS-upgradeable, two-step ownership, pausable. State lives in ERC-7201 namespaced storage so
/// upgrades cannot collide with inherited layouts. The token is fixed at initialization to G$, a standard
/// (non-fee-on-transfer) SuperToken, so transfers use SafeERC20 without balance-delta checks: on G$ each
/// balanceOf costs ~160k gas and the checks doubled the cost of every payment (ADR-0006).
abstract contract SlyceBase is Initializable, UUPSUpgradeable, Ownable2StepUpgradeable, PausableUpgradeable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    /// @custom:storage-location erc7201:slyce.storage.Base
    struct BaseStorage {
        IERC20 token;
        address treasury;
    }

    // keccak256(abi.encode(uint256(keccak256("slyce.storage.Base")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 internal constant BASE_STORAGE = 0x209a1f84fdc131d23d9427051dda8cc50f88e8f2c56a4ae019075e8d28cc1000;

    event TreasuryChanged(address indexed treasury);

    error ZeroAddress();
    error InvalidTreasury();
    error RenounceDisabled();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function __SlyceBase_init(IERC20 token_, address treasury_, address owner_) internal onlyInitializing {
        if (address(token_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        __Ownable_init(owner_);
        __Ownable2Step_init();
        __Pausable_init();
        _baseStorage().token = token_;
        _setTreasury(treasury_);
    }

    function token() public view returns (IERC20) {
        return _baseStorage().token;
    }

    function treasury() public view returns (address) {
        return _baseStorage().treasury;
    }

    function setTreasury(address treasury_) external onlyOwner {
        _setTreasury(treasury_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Ownership can only move via the two-step transfer; renouncing would brick upgrades and payouts.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    function _setTreasury(address treasury_) private {
        if (treasury_ == address(0)) revert ZeroAddress();
        if (treasury_ == address(this)) revert InvalidTreasury();
        _baseStorage().treasury = treasury_;
        emit TreasuryChanged(treasury_);
    }

    function _pull(address from, address to, uint256 amount) internal {
        _baseStorage().token.safeTransferFrom(from, to, amount);
    }

    function _push(address to, uint256 amount) internal {
        _baseStorage().token.safeTransfer(to, amount);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _baseStorage() private pure returns (BaseStorage storage $) {
        assembly {
            $.slot := BASE_STORAGE
        }
    }
}
