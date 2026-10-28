// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SlyceBase} from "./SlyceBase.sol";

/// @title Slyce Shop (UUPS)
/// @notice Sells items for G$. Payment goes straight to the treasury; the contract never holds funds.
/// Purchases are recorded on-chain so the app reads ownership without an indexer.
contract SlyceShop is SlyceBase {
    struct Item {
        uint128 price; // G$ smallest units per item
        uint32 maxPerWallet; // 0 = unlimited; 1 = one-time cosmetic
        bool active;
        bool exists;
    }

    /// @custom:storage-location erc7201:slyce.storage.Shop
    struct ShopStorage {
        mapping(uint256 itemId => Item) items;
        mapping(address buyer => mapping(uint256 itemId => uint256 quantity)) purchased;
    }

    // keccak256(abi.encode(uint256(keccak256("slyce.storage.Shop")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 internal constant SHOP_STORAGE = 0x6ef2fc3b29a55afa2f3499e5a0cdc30851a5f2da014b8c637498d2b14ca0d900;

    uint256 public constant MAX_PRICE = 1_000_000 ether;
    uint256 public constant MAX_QUANTITY = 100;

    event ItemSet(uint256 indexed itemId, uint128 price, uint32 maxPerWallet, bool active);
    event Purchased(address indexed buyer, uint256 indexed itemId, uint256 quantity, uint256 paid);

    error ItemUnavailable(uint256 itemId);
    error InvalidQuantity();
    error WalletLimit(uint256 itemId, uint256 maxPerWallet);
    error PriceAboveLimit(uint256 total, uint256 maxTotal);
    error InvalidPrice();

    function initialize(IERC20 token_, address treasury_, address owner_) external initializer {
        __SlyceBase_init(token_, treasury_, owner_);
    }

    function version() external pure virtual returns (string memory) {
        return "1.1.0";
    }

    function items(uint256 itemId) external view returns (Item memory) {
        return _shop().items[itemId];
    }

    function purchased(address buyer, uint256 itemId) external view returns (uint256) {
        return _shop().purchased[buyer][itemId];
    }

    function setItem(uint256 itemId, uint128 price, uint32 maxPerWallet, bool active) external onlyOwner {
        if (price == 0 || price > MAX_PRICE) revert InvalidPrice();
        _shop().items[itemId] = Item(price, maxPerWallet, active, true);
        emit ItemSet(itemId, price, maxPerWallet, active);
    }

    /// @param maxTotal Protects the buyer if the price changes after the UI displayed it.
    function buy(uint256 itemId, uint256 quantity, uint256 maxTotal) external whenNotPaused nonReentrant {
        ShopStorage storage $ = _shop();
        Item memory item = $.items[itemId];
        if (!item.exists || !item.active) revert ItemUnavailable(itemId);
        if (quantity == 0 || quantity > MAX_QUANTITY) revert InvalidQuantity();
        uint256 owned = $.purchased[msg.sender][itemId] + quantity;
        if (item.maxPerWallet != 0 && owned > item.maxPerWallet) revert WalletLimit(itemId, item.maxPerWallet);
        uint256 total = uint256(item.price) * quantity;
        if (total > maxTotal) revert PriceAboveLimit(total, maxTotal);
        $.purchased[msg.sender][itemId] = owned;
        emit Purchased(msg.sender, itemId, quantity, total);
        _pull(msg.sender, treasury(), total);
    }

    function _shop() private pure returns (ShopStorage storage $) {
        assembly {
            $.slot := SHOP_STORAGE
        }
    }
}
