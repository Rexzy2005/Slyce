// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {SlyceArcade} from "../src/SlyceArcade.sol";
import {SlyceTest} from "./utils/SlyceTest.sol";

contract SlyceArcadeTest is SlyceTest {
    SlyceArcade arcade;

    function setUp() public override {
        super.setUp();
        arcade = deployArcade(IERC20(address(token)), 1 ether);
        fund(alice, address(arcade), 100 ether);
    }

    function test_playChargesFeeAndCountsRounds() public {
        vm.expectEmit(address(arcade));
        emit SlyceArcade.RoundPaid(alice, 1, 1, 1 ether, 0);
        vm.prank(alice);
        assertEq(arcade.play(1 ether), 1);
        vm.prank(alice);
        arcade.play(1 ether);
        assertEq(token.balanceOf(treasury), 2 ether);
        assertEq(token.balanceOf(address(arcade)), 0);
        assertEq(arcade.roundsPlayed(alice), 2);
        assertEq(arcade.totalRounds(), 2);
    }

    function test_feeChangeProtection() public {
        vm.prank(owner);
        arcade.setPlayFee(2 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SlyceArcade.FeeAboveLimit.selector, 2 ether, 1 ether));
        arcade.play(1 ether);
    }

    function test_freePlayNeedsNoTokens() public {
        vm.prank(owner);
        arcade.setPlayFee(0);
        vm.prank(bob);
        arcade.play(0);
        assertEq(arcade.roundsPlayed(bob), 1);
    }

    function test_insufficientBalanceReverts() public {
        vm.prank(bob); // no G$, no approval
        vm.expectRevert();
        arcade.play(1 ether);
        assertEq(arcade.roundsPlayed(bob), 0);
    }

    function test_feeBoundsAndAccess() public {
        uint128 tooHigh = uint128(arcade.MAX_PLAY_FEE() + 1);
        vm.prank(owner);
        vm.expectRevert(SlyceArcade.InvalidFee.selector);
        arcade.setPlayFee(tooHigh);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        arcade.setPlayFee(0);
    }

    function test_pauseBlocksPlay() public {
        vm.prank(owner);
        arcade.pause();
        vm.prank(alice);
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        arcade.play(1 ether);
    }

    function testFuzz_play(uint128 fee, uint8 rounds) public {
        fee = uint128(bound(fee, 0, arcade.MAX_PLAY_FEE()));
        rounds = uint8(bound(rounds, 1, 20));
        vm.prank(owner);
        arcade.setPlayFee(fee);
        fund(carol, address(arcade), uint256(fee) * rounds);
        for (uint256 i; i < rounds; i++) {
            vm.prank(carol);
            arcade.play(fee);
        }
        assertEq(token.balanceOf(treasury), uint256(fee) * rounds);
        assertEq(arcade.roundsPlayed(carol), rounds);
    }
}
