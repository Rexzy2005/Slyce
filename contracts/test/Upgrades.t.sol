// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1967Utils} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {SlyceShop} from "../src/SlyceShop.sol";
import {SlyceTournament} from "../src/SlyceTournament.sol";
import {SlyceArcade} from "../src/SlyceArcade.sol";
import {SlyceTest} from "./utils/SlyceTest.sol";
import {SlyceShopV2, SlyceTournamentV2, SlyceArcadeV2, NotUpgradeable} from "./utils/V2Mocks.sol";

/// Exposes the internal slot constants so they can be checked against the ERC-7201 formula.
// Test-only slot exposer, never deployed behind a proxy.
/// @custom:oz-upgrades-unsafe-allow missing-initializer
contract ShopSlots is SlyceShop {
    function slots() external pure returns (bytes32, bytes32) {
        return (BASE_STORAGE, SHOP_STORAGE);
    }
}

// Test-only slot exposer, never deployed behind a proxy.
/// @custom:oz-upgrades-unsafe-allow missing-initializer
contract TournamentSlots is SlyceTournament {
    function slot() external pure returns (bytes32) {
        return TOURNAMENT_STORAGE;
    }
}

// Test-only slot exposer, never deployed behind a proxy.
/// @custom:oz-upgrades-unsafe-allow missing-initializer
contract ArcadeSlots is SlyceArcade {
    function slot() external pure returns (bytes32) {
        return ARCADE_STORAGE;
    }
}

contract UpgradesTest is SlyceTest {
    function erc7201(string memory namespace) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint256(keccak256(bytes(namespace))) - 1)) & ~bytes32(uint256(0xff));
    }

    function implementationOf(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, ERC1967Utils.IMPLEMENTATION_SLOT))));
    }

    function test_storageSlotsMatchErc7201() public {
        (bytes32 base, bytes32 shop) = new ShopSlots().slots();
        assertEq(base, erc7201("slyce.storage.Base"));
        assertEq(shop, erc7201("slyce.storage.Shop"));
        assertEq(new TournamentSlots().slot(), erc7201("slyce.storage.Tournament"));
        assertEq(new ArcadeSlots().slot(), erc7201("slyce.storage.Arcade"));
    }

    function test_implementationsCannotBeInitialized() public {
        SlyceShop shopImpl = new SlyceShop();
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        shopImpl.initialize(IERC20(address(token)), treasury, owner);
        SlyceTournament tournamentImpl = new SlyceTournament();
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        tournamentImpl.initialize(IERC20(address(token)), treasury, owner);
        SlyceArcade arcadeImpl = new SlyceArcade();
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        arcadeImpl.initialize(IERC20(address(token)), treasury, owner, 0);
    }

    function test_proxiesCannotBeReinitialized() public {
        SlyceShop shop = deployShop(IERC20(address(token)));
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        shop.initialize(IERC20(address(token)), alice, alice);
        SlyceArcade arcade = deployArcade(IERC20(address(token)), 1 ether);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        arcade.initialize(IERC20(address(token)), alice, alice, 0);
    }

    function test_onlyOwnerCanUpgrade() public {
        SlyceShop shop = deployShop(IERC20(address(token)));
        address v2 = address(new SlyceShopV2());
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        shop.upgradeToAndCall(v2, "");
    }

    function test_rejectsNonUupsImplementation() public {
        SlyceShop shop = deployShop(IERC20(address(token)));
        address broken = address(new NotUpgradeable());
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ERC1967Utils.ERC1967InvalidImplementation.selector, broken));
        shop.upgradeToAndCall(broken, "");
        assertEq(shop.version(), "1.3.0");
    }

    function test_shopUpgradePreservesState() public {
        SlyceShop shop = deployShop(IERC20(address(token)));
        vm.prank(owner);
        shop.setItem(101, 50 ether, 1, true);
        fund(alice, address(shop), 50 ether);
        vm.prank(alice);
        shop.buy(101, 1, 50 ether);

        address v2 = address(new SlyceShopV2());
        vm.prank(owner);
        shop.upgradeToAndCall(v2, abi.encodeCall(SlyceShopV2.initializeV2, (7)));

        assertEq(implementationOf(address(shop)), v2);
        assertEq(shop.version(), "2.0.0");
        assertEq(shop.owner(), owner);
        assertEq(shop.treasury(), treasury);
        assertEq(address(shop.token()), address(token));
        assertEq(shop.purchased(alice, 101), 1);
        assertEq(shop.items(101).price, 50 ether);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        SlyceShopV2(address(shop)).initializeV2(8); // V2 initializer runs once
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SlyceShop.WalletLimit.selector, 101, 1));
        shop.buy(101, 1, 50 ether);
    }

    function test_tournamentUpgradePreservesFundsAndClaims() public {
        SlyceTournament t = deployTournament(IERC20(address(token)));
        vm.prank(owner);
        uint256 id = t.createTournament(uint64(block.timestamp), uint64(block.timestamp + 1 days), 10 ether, 0);
        fund(alice, address(t), 10 ether);
        vm.prank(alice);
        t.enter(id);
        vm.prank(alice);
        t.submitScore(id, 42);

        address v2 = address(new SlyceTournamentV2());
        vm.prank(owner);
        t.upgradeToAndCall(v2, "");
        assertEq(t.version(), "2.0.0");
        assertEq(t.tournamentCount(), 1);
        assertEq(t.liabilities(), 10 ether);
        assertEq(t.bestScore(id, alice), 42);
        assertTrue(t.entered(id, alice));

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(id, alice, uint128(10 ether)))));
        vm.warp(block.timestamp + 1 days);
        vm.prank(owner);
        t.postResults(id, leaf, 10 ether);
        vm.prank(alice);
        t.claim(id, 10 ether, new bytes32[](0));
        assertEq(token.balanceOf(alice), 10 ether);
    }

    function test_arcadeUpgradePreservesFeeAndCounters() public {
        SlyceArcade arcade = deployArcade(IERC20(address(token)), 2 ether);
        fund(alice, address(arcade), 2 ether);
        vm.prank(alice);
        arcade.play(2 ether);
        address v2 = address(new SlyceArcadeV2());
        vm.prank(owner);
        arcade.upgradeToAndCall(v2, "");
        assertEq(arcade.version(), "2.0.0");
        assertEq(arcade.playFee(), 2 ether);
        assertEq(arcade.roundsPlayed(alice), 1);
        assertEq(arcade.totalRounds(), 1);
    }

    function test_pendingOwnerCannotUpgradeUntilAccepted() public {
        SlyceShop shop = deployShop(IERC20(address(token)));
        vm.prank(owner);
        shop.transferOwnership(bob);
        address v2 = address(new SlyceShopV2());
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        shop.upgradeToAndCall(v2, "");
        vm.prank(bob);
        shop.acceptOwnership();
        vm.prank(bob);
        shop.upgradeToAndCall(v2, "");
        assertEq(shop.version(), "2.0.0");
    }
}
