// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SlyceBase} from "../src/SlyceBase.sol";
import {SlyceShop} from "../src/SlyceShop.sol";
import {SlyceTournament} from "../src/SlyceTournament.sol";
import {SlyceArcade} from "../src/SlyceArcade.sol";
import {SlyceTest} from "./utils/SlyceTest.sol";

contract EdgeCasesTest is SlyceTest {
    function test_initializeRejectsZeroAddresses() public {
        address impl = address(new SlyceShop());
        vm.expectRevert(SlyceBase.ZeroAddress.selector);
        new ERC1967Proxy(impl, abi.encodeCall(SlyceShop.initialize, (IERC20(address(0)), treasury, owner)));
        vm.expectRevert(SlyceBase.ZeroAddress.selector);
        new ERC1967Proxy(impl, abi.encodeCall(SlyceShop.initialize, (IERC20(address(token)), address(0), owner)));
        vm.expectRevert(SlyceBase.ZeroAddress.selector);
        new ERC1967Proxy(impl, abi.encodeCall(SlyceShop.initialize, (IERC20(address(token)), treasury, address(0))));
    }

    function test_arcadeInitRejectsExcessiveFee() public {
        address impl = address(new SlyceArcade());
        vm.expectRevert(SlyceArcade.InvalidFee.selector);
        new ERC1967Proxy(impl, abi.encodeCall(SlyceArcade.initialize, (IERC20(address(token)), treasury, owner, 101 ether)));
    }

    function test_versionsAndViews() public {
        SlyceTournament t = deployTournament(IERC20(address(token)));
        SlyceArcade arcade = deployArcade(IERC20(address(token)), 0);
        assertEq(t.version(), "1.3.0");
        assertEq(arcade.version(), "1.3.0");
        vm.prank(owner);
        uint256 id = t.createTournament(uint64(block.timestamp), uint64(block.timestamp + 1 hours), 1 ether, 0);
        fund(alice, address(t), 10 ether);
        vm.startPrank(alice);
        t.enter(id);
        t.sponsor(id, 4 ether);
        vm.stopPrank();
        assertEq(t.sponsored(id, alice), 4 ether);
        assertFalse(t.refunded(id, alice));
        assertFalse(t.prizeClaimed(id, alice));
        vm.prank(owner);
        t.cancelTournament(id);
        vm.prank(alice);
        t.refund(id);
        assertTrue(t.refunded(id, alice));
        assertEq(token.balanceOf(alice), 10 ether);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SlyceTournament.Cancelled.selector, id));
        t.cancelTournament(id);
    }

    function test_sponsorValidation() public {
        SlyceTournament t = deployTournament(IERC20(address(token)));
        vm.prank(owner);
        uint256 id = t.createTournament(uint64(block.timestamp), uint64(block.timestamp + 1 hours), 0, 0);
        fund(alice, address(t), 2_000_000 ether);
        vm.startPrank(alice);
        vm.expectRevert(SlyceTournament.InvalidAmount.selector);
        t.sponsor(id, 0);
        vm.expectRevert(SlyceTournament.InvalidAmount.selector);
        t.sponsor(id, 1_000_001 ether);
        vm.stopPrank();
        vm.warp(block.timestamp + 1 hours);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SlyceTournament.NotOpen.selector, id));
        t.sponsor(id, 1 ether);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SlyceTournament.ResultsNotPosted.selector, id));
        t.sweepUnclaimed(id);
    }

    function test_rescueRejectsZeroRecipient() public {
        SlyceTournament t = deployTournament(IERC20(address(token)));
        vm.prank(owner);
        vm.expectRevert(SlyceBase.ZeroAddress.selector);
        t.rescue(IERC20(address(token)), address(0), 0);
    }
}
