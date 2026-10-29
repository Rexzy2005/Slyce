// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {SlyceArcade} from "../src/SlyceArcade.sol";
import {SlyceTest} from "./utils/SlyceTest.sol";
import {MockIdentity} from "./VerifiedHumans.t.sol";

/// Free-to-play game records with XP, streaks and G$ milestone rewards for verified humans.
contract GameRecordsTest is SlyceTest {
    SlyceArcade arcade;
    MockIdentity identity = new MockIdentity();

    function setUp() public override {
        super.setUp();
        vm.warp(1_800_000_000);
        arcade = deployArcade(IERC20(address(token)), 0);
        uint32[] memory scores = new uint32[](4);
        uint128[] memory rewards = new uint128[](4);
        (scores[0], scores[1], scores[2], scores[3]) = (500, 1000, 2500, 5000);
        (rewards[0], rewards[1], rewards[2], rewards[3]) = (5 ether, 15 ether, 40 ether, 100 ether);
        vm.startPrank(owner);
        arcade.setIdentity(address(identity));
        arcade.setGameRules(100_000, 20);
        arcade.setMilestones(scores, rewards);
        vm.stopPrank();
        fund(owner, address(arcade), 1000 ether);
        vm.prank(owner);
        arcade.fundRewards(1000 ether);
        identity.verify(alice, alice);
    }

    function play(address who, uint32 score) internal {
        vm.prank(who);
        arcade.submitGame(score, 3, 10);
        vm.warp(block.timestamp + 21);
    }

    function test_recordsStatsAndXp() public {
        play(bob, 1234);
        play(bob, 800);
        SlyceArcade.PlayerStats memory s = arcade.playerStats(bob);
        assertEq(s.games, 2);
        assertEq(s.xp, 123 + 80);
        assertEq(s.bestScore, 1234);
        assertEq(s.streak, 1);
        assertEq(arcade.totalGames(), 2);
        assertEq(token.balanceOf(bob), 0); // unverified: no G$
    }

    function test_streakCountsConsecutiveDays() public {
        play(bob, 10);
        vm.warp(block.timestamp + 1 days);
        play(bob, 10);
        vm.warp(block.timestamp + 1 days);
        play(bob, 10);
        assertEq(arcade.playerStats(bob).streak, 3);
        vm.warp(block.timestamp + 3 days);
        play(bob, 10);
        assertEq(arcade.playerStats(bob).streak, 1);
    }

    function test_verifiedHumanEarnsEachMilestoneOncePerDay() public {
        play(alice, 2600); // 500, 1000, 2500
        assertEq(token.balanceOf(alice), 60 ether);
        play(alice, 2600); // already rewarded today
        assertEq(token.balanceOf(alice), 60 ether);
        play(alice, 6000); // only 5000 is new
        assertEq(token.balanceOf(alice), 160 ether);
        assertEq(arcade.rewardedToday(alice), 15);
        vm.warp(block.timestamp + 1 days);
        play(alice, 600);
        assertEq(token.balanceOf(alice), 165 ether);
        SlyceArcade.PlayerStats memory s = arcade.playerStats(alice);
        assertEq(s.earned, 165 ether);
        assertEq(arcade.totalRewardsPaid(), 165 ether);
        assertEq(arcade.rewardBudget(), 1000 ether - 165 ether);
        assertEq(token.balanceOf(address(arcade)), arcade.rewardBudget());
    }

    function test_linkedWalletsShareTheDailyLimit() public {
        identity.verify(carol, alice); // carol is linked to alice's identity
        play(alice, 600);
        play(carol, 600);
        assertEq(token.balanceOf(alice), 5 ether);
        assertEq(token.balanceOf(carol), 0);
    }

    function test_unfundedMilestoneStillRecordsTheGame() public {
        vm.prank(owner);
        arcade.withdrawRewards(owner, 995 ether); // 5 G$ left
        play(alice, 1200); // 500 (5 G$) paid, 1000 (15 G$) skipped
        assertEq(token.balanceOf(alice), 5 ether);
        assertEq(arcade.playerStats(alice).games, 1);
        assertEq(arcade.rewardBudget(), 0);
    }

    function test_rateLimitAndScoreCap() public {
        vm.startPrank(bob);
        arcade.submitGame(100, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(SlyceArcade.TooSoon.selector, uint64(block.timestamp + 20)));
        arcade.submitGame(100, 0, 0);
        vm.warp(block.timestamp + 20);
        vm.expectRevert(SlyceArcade.InvalidScore.selector);
        arcade.submitGame(100_001, 0, 0);
        vm.stopPrank();
    }

    function test_closedUntilConfiguredAndPausable() public {
        SlyceArcade fresh = deployArcade(IERC20(address(token)), 0);
        vm.prank(bob);
        vm.expectRevert(SlyceArcade.GamesClosed.selector);
        fresh.submitGame(1, 0, 0);
        vm.prank(owner);
        arcade.pause();
        vm.prank(bob);
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        arcade.submitGame(1, 0, 0);
    }

    function test_milestoneValidationAndAccess() public {
        uint32[] memory scores = new uint32[](2);
        uint128[] memory rewards = new uint128[](2);
        (scores[0], scores[1]) = (1000, 500); // not ascending
        vm.startPrank(owner);
        vm.expectRevert(SlyceArcade.InvalidMilestones.selector);
        arcade.setMilestones(scores, rewards);
        (scores[0], scores[1]) = (500, 1000);
        rewards[1] = 1001 ether; // above cap
        vm.expectRevert(SlyceArcade.InvalidMilestones.selector);
        arcade.setMilestones(scores, rewards);
        vm.expectRevert(abi.encodeWithSelector(SlyceArcade.InsufficientBudget.selector, 2000 ether, 1000 ether));
        arcade.withdrawRewards(owner, 2000 ether);
        vm.stopPrank();
        bytes memory err = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob);
        vm.startPrank(bob);
        vm.expectRevert(err);
        arcade.setMilestones(scores, rewards);
        vm.expectRevert(err);
        arcade.withdrawRewards(bob, 1);
        vm.expectRevert(err);
        arcade.setGameRules(0, 0);
        vm.stopPrank();
    }

    function test_anyoneCanSponsorThePot() public {
        fund(bob, address(arcade), 50 ether);
        vm.prank(bob);
        arcade.fundRewards(50 ether);
        assertEq(arcade.rewardBudget(), 1050 ether);
    }

    function testFuzz_rewardsNeverExceedBudget(uint32 score, uint8 games) public {
        score = uint32(bound(score, 0, 100_000));
        games = uint8(bound(games, 1, 10));
        for (uint256 i; i < games; i++) {
            play(alice, score);
            vm.warp(block.timestamp + 1 days);
        }
        assertEq(token.balanceOf(address(arcade)), arcade.rewardBudget());
        assertEq(token.balanceOf(alice) + arcade.rewardBudget(), 1000 ether);
    }
}
