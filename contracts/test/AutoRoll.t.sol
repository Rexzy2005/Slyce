// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SlyceTournament} from "../src/SlyceTournament.sol";
import {SlyceArcade} from "../src/SlyceArcade.sol";
import {SlyceTest} from "./utils/SlyceTest.sol";

/// Tournaments start themselves: no daily admin transaction needed.
contract AutoRollTest is SlyceTest {
    SlyceTournament t;
    SlyceArcade arcade;

    function setUp() public override {
        super.setUp();
        t = deployTournament(IERC20(address(token)));
        arcade = deployArcade(IERC20(address(token)), 1 ether);
        vm.startPrank(owner);
        t.setArcade(address(arcade));
        arcade.setPrizePool(address(t));
        t.setAutoRoll(1 days);
        vm.stopPrank();
        fund(alice, address(arcade), 100 ether);
    }

    function test_firstRoundStartsATournament() public {
        assertEq(t.tournamentCount(), 0);
        vm.prank(alice);
        arcade.play(1 ether);
        assertEq(t.tournamentCount(), 1);
        assertEq(t.openPrizeTournament(), 1);
        assertEq(t.getTournament(1).pool, 1 ether);
        assertEq(t.getTournament(1).endTime, block.timestamp + 1 days);
    }

    function test_nextTournamentStartsAfterTheLastEnds() public {
        vm.prank(alice);
        arcade.play(1 ether);
        vm.warp(block.timestamp + 1 days);
        assertEq(t.openPrizeTournament(), 0);
        vm.prank(alice);
        arcade.play(1 ether);
        assertEq(t.tournamentCount(), 2);
        assertEq(t.getTournament(1).pool, 1 ether); // last pool stays for its winners
        assertEq(t.getTournament(2).pool, 1 ether);
        assertEq(token.balanceOf(address(t)), t.liabilities());
    }

    function test_anyoneCanStartButNotReconfigure() public {
        vm.prank(bob);
        assertEq(t.ensurePrizeTournament(), 1);
        vm.prank(bob);
        assertEq(t.ensurePrizeTournament(), 1); // idempotent while open
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        t.setAutoRoll(10 minutes);
    }

    function test_autoRollOffKeepsTreasuryRouting() public {
        vm.prank(owner);
        t.setAutoRoll(0);
        assertEq(t.ensurePrizeTournament(), 0);
        vm.prank(alice);
        arcade.play(1 ether);
        assertEq(t.tournamentCount(), 0);
        assertEq(token.balanceOf(treasury), 1 ether);
    }

    function test_autoRollBounds() public {
        vm.startPrank(owner);
        vm.expectRevert(SlyceTournament.InvalidSchedule.selector);
        t.setAutoRoll(9 minutes);
        vm.expectRevert(SlyceTournament.InvalidSchedule.selector);
        t.setAutoRoll(32 days);
        vm.stopPrank();
    }

    function test_pausedTournamentDoesNotRoll() public {
        vm.prank(owner);
        t.pause();
        assertEq(t.ensurePrizeTournament(), 0);
    }
}
