// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SlyceTournament} from "../src/SlyceTournament.sol";
import {SlyceArcade} from "../src/SlyceArcade.sol";
import {SlyceTest} from "./utils/SlyceTest.sol";

/// Play fees grow the open daily prize pool; winners are paid from it.
contract PrizePoolTest is SlyceTest {
    SlyceTournament t;
    SlyceArcade arcade;
    uint256 id;

    function setUp() public override {
        super.setUp();
        t = deployTournament(IERC20(address(token)));
        arcade = deployArcade(IERC20(address(token)), 1 ether);
        vm.startPrank(owner);
        t.setArcade(address(arcade));
        arcade.setPrizePool(address(t));
        id = t.createTournament(uint64(block.timestamp), uint64(block.timestamp + 1 days), 0, 0);
        t.setPrizeTournament(id);
        vm.stopPrank();
        fund(alice, address(arcade), 100 ether);
        fund(bob, address(arcade), 100 ether);
    }

    function test_playFeesGrowTheOpenPrizePool() public {
        vm.expectEmit(address(arcade));
        emit SlyceArcade.RoundPaid(alice, 1, 1, 1 ether, id);
        vm.prank(alice);
        arcade.play(1 ether);
        vm.prank(bob);
        arcade.play(1 ether);
        assertEq(t.getTournament(id).pool, 2 ether);
        assertEq(t.liabilities(), 2 ether);
        assertEq(token.balanceOf(address(t)), 2 ether);
        assertEq(token.balanceOf(treasury), 0);
        assertEq(t.sponsored(id, treasury), 2 ether);
    }

    function test_winnersArePaidFromPlayFees() public {
        vm.prank(alice);
        t.enter(id);
        vm.prank(alice);
        t.submitScore(id, 900);
        for (uint256 i; i < 5; i++) {
            vm.prank(bob);
            arcade.play(1 ether);
        }
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(id, alice, uint128(5 ether)))));
        vm.warp(block.timestamp + 1 days);
        vm.prank(owner);
        t.postResults(id, leaf, 5 ether);
        vm.prank(alice);
        t.claim(id, 5 ether, new bytes32[](0));
        assertEq(token.balanceOf(alice), 105 ether);
        assertEq(token.balanceOf(address(t)), t.liabilities());
    }

    function test_feesGoToTreasuryWhenNoPoolIsOpen() public {
        vm.warp(block.timestamp + 1 days); // tournament ended
        assertEq(t.openPrizeTournament(), 0);
        vm.prank(alice);
        arcade.play(1 ether);
        assertEq(token.balanceOf(treasury), 1 ether);
        assertEq(t.getTournament(id).pool, 0);

        vm.prank(owner);
        t.setPrizeTournament(0);
        vm.prank(bob);
        arcade.play(1 ether);
        assertEq(token.balanceOf(treasury), 2 ether);
    }

    function test_onlyArcadeCanCredit() public {
        vm.prank(alice);
        vm.expectRevert(SlyceTournament.NotArcade.selector);
        t.creditFromArcade(1 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        t.setArcade(alice);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        arcade.setPrizePool(alice);
    }

    function test_cancelledPoolRefundsPlayFeesToTreasury() public {
        vm.prank(alice);
        arcade.play(1 ether);
        vm.prank(owner);
        t.cancelTournament(id);
        assertEq(t.openPrizeTournament(), 0);
        vm.prank(treasury);
        t.refund(id);
        assertEq(token.balanceOf(treasury), 1 ether);
        assertEq(t.liabilities(), 0);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SlyceTournament.Cancelled.selector, id));
        t.setPrizeTournament(id);
    }

    function testFuzz_poolAlwaysSolvent(uint8 rounds, uint128 fee) public {
        fee = uint128(bound(fee, 1, arcade.MAX_PLAY_FEE()));
        rounds = uint8(bound(rounds, 1, 30));
        vm.prank(owner);
        arcade.setPlayFee(fee);
        fund(carol, address(arcade), uint256(fee) * rounds);
        for (uint256 i; i < rounds; i++) {
            vm.prank(carol);
            arcade.play(fee);
        }
        assertEq(t.getTournament(id).pool, uint256(fee) * rounds);
        assertEq(token.balanceOf(address(t)), t.liabilities());
    }
}
