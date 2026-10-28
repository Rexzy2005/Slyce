// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {SlyceShop} from "../src/SlyceShop.sol";
import {SlyceBase} from "../src/SlyceBase.sol";
import {SlyceTest} from "./utils/SlyceTest.sol";

contract SlyceShopTest is SlyceTest {
    SlyceShop shop;

    function setUp() public override {
        super.setUp();
        shop = deployShop(IERC20(address(token)));
        vm.startPrank(owner);
        shop.setItem(1, 10 ether, 0, true); // consumable
        shop.setItem(101, 50 ether, 1, true); // cosmetic
        vm.stopPrank();
        fund(alice, address(shop), 10_000 ether);
    }

    function test_initialState() public view {
        assertEq(address(shop.token()), address(token));
        assertEq(shop.treasury(), treasury);
        assertEq(shop.owner(), owner);
        assertEq(shop.version(), "1.1.0");
        assertFalse(shop.paused());
    }

    function test_buyPaysTreasuryAndRecordsOwnership() public {
        vm.expectEmit(address(shop));
        emit SlyceShop.Purchased(alice, 1, 3, 30 ether);
        vm.prank(alice);
        shop.buy(1, 3, 30 ether);
        assertEq(token.balanceOf(treasury), 30 ether);
        assertEq(token.balanceOf(address(shop)), 0);
        assertEq(shop.purchased(alice, 1), 3);
    }

    function test_cosmeticLimitedToOnePerWallet() public {
        vm.startPrank(alice);
        shop.buy(101, 1, 50 ether);
        vm.expectRevert(abi.encodeWithSelector(SlyceShop.WalletLimit.selector, 101, 1));
        shop.buy(101, 1, 50 ether);
        vm.stopPrank();
    }

    function test_priceChangeProtection() public {
        vm.prank(owner);
        shop.setItem(1, 20 ether, 0, true);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SlyceShop.PriceAboveLimit.selector, 20 ether, 10 ether));
        shop.buy(1, 1, 10 ether);
    }

    function test_rejectsUnknownInactiveAndBadQuantity() public {
        vm.prank(owner);
        shop.setItem(2, 1 ether, 0, false);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(SlyceShop.ItemUnavailable.selector, 9));
        shop.buy(9, 1, 1 ether);
        vm.expectRevert(abi.encodeWithSelector(SlyceShop.ItemUnavailable.selector, 2));
        shop.buy(2, 1, 1 ether);
        vm.expectRevert(SlyceShop.InvalidQuantity.selector);
        shop.buy(1, 0, 0);
        vm.expectRevert(SlyceShop.InvalidQuantity.selector);
        shop.buy(1, 101, type(uint256).max);
        vm.stopPrank();
    }

    function test_setItemBounds() public {
        uint128 tooHigh = uint128(shop.MAX_PRICE() + 1);
        vm.startPrank(owner);
        vm.expectRevert(SlyceShop.InvalidPrice.selector);
        shop.setItem(3, 0, 0, false);
        vm.expectRevert(SlyceShop.InvalidPrice.selector);
        shop.setItem(3, tooHigh, 0, true);
        vm.stopPrank();
    }

    function test_onlyOwnerAdmin() public {
        bytes memory err = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice);
        vm.startPrank(alice);
        vm.expectRevert(err);
        shop.setItem(3, 1 ether, 0, true);
        vm.expectRevert(err);
        shop.setTreasury(alice);
        vm.expectRevert(err);
        shop.pause();
        vm.stopPrank();
    }

    function test_pauseBlocksBuying() public {
        vm.prank(owner);
        shop.pause();
        vm.prank(alice);
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        shop.buy(1, 1, 10 ether);
        vm.prank(owner);
        shop.unpause();
        vm.prank(alice);
        shop.buy(1, 1, 10 ether);
    }

    function test_treasuryValidation() public {
        vm.startPrank(owner);
        vm.expectRevert(SlyceBase.ZeroAddress.selector);
        shop.setTreasury(address(0));
        vm.expectRevert(SlyceBase.InvalidTreasury.selector);
        shop.setTreasury(address(shop));
        vm.stopPrank();
    }

    function test_renounceDisabledAndTwoStepTransfer() public {
        vm.prank(owner);
        vm.expectRevert(SlyceBase.RenounceDisabled.selector);
        shop.renounceOwnership();
        vm.prank(owner);
        shop.transferOwnership(bob);
        assertEq(shop.owner(), owner); // pending until accepted
        vm.prank(bob);
        shop.acceptOwnership();
        assertEq(shop.owner(), bob);
    }

    /// The payment token is fixed at initialization; there is no way to point a live proxy at another token.
    function test_tokenIsImmutableAfterInitialization() public {
        (bool ok,) = address(shop).call(abi.encodeWithSignature("setToken(address)", address(this)));
        assertFalse(ok);
        assertEq(address(shop.token()), address(token));
    }

    function testFuzz_buy(uint128 price, uint8 quantity) public {
        price = uint128(bound(price, 1, shop.MAX_PRICE() / 100));
        quantity = uint8(bound(quantity, 1, 100));
        vm.prank(owner);
        shop.setItem(7, price, 0, true);
        uint256 total = uint256(price) * quantity;
        fund(bob, address(shop), total);
        vm.prank(bob);
        shop.buy(7, quantity, total);
        assertEq(token.balanceOf(treasury), total);
        assertEq(token.balanceOf(bob), 0);
        assertEq(shop.purchased(bob, 7), quantity);
    }

    function testFuzz_insufficientAllowanceReverts(uint128 price) public {
        price = uint128(bound(price, 1, shop.MAX_PRICE()));
        vm.prank(owner);
        shop.setItem(8, price, 0, true);
        token.mint(carol, price);
        vm.prank(carol);
        vm.expectRevert();
        shop.buy(8, 1, price); // no approval
        assertEq(shop.purchased(carol, 8), 0);
    }
}
