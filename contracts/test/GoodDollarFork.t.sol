// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SlyceShop} from "../src/SlyceShop.sol";
import {SlyceTournament} from "../src/SlyceTournament.sol";
import {SlyceArcade} from "../src/SlyceArcade.sol";

/// Runs the proxied contracts against real G$ on Celo mainnet. Skipped unless CELO_RPC_URL is set.
/// Addresses: docs/research/gooddollar.md.
contract GoodDollarForkTest is Test {
    IERC20 constant GD = IERC20(0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A);
    address constant UBI_SCHEME = 0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1; // holds G$ to fund the test player
    address player = makeAddr("player");
    address treasury = makeAddr("treasury");

    function setUp() public {
        string memory rpc = vm.envOr("CELO_RPC_URL", string(""));
        if (bytes(rpc).length == 0) vm.skip(true);
        vm.createSelectFork(rpc);
        vm.prank(UBI_SCHEME);
        GD.transfer(player, 1000 ether);
    }

    function test_realGoodDollarEndToEnd() public {
        SlyceShop shop = SlyceShop(address(new ERC1967Proxy(address(new SlyceShop()), abi.encodeCall(SlyceShop.initialize, (GD, treasury, address(this))))));
        shop.setItem(101, 25 ether, 1, true);
        SlyceArcade arcade = SlyceArcade(address(new ERC1967Proxy(address(new SlyceArcade()), abi.encodeCall(SlyceArcade.initialize, (GD, treasury, address(this), 1 ether)))));
        SlyceTournament t = SlyceTournament(address(new ERC1967Proxy(address(new SlyceTournament()), abi.encodeCall(SlyceTournament.initialize, (GD, treasury, address(this))))));
        uint256 id = t.createTournament(uint64(block.timestamp), uint64(block.timestamp + 1 days), 10 ether, 0);

        vm.startPrank(player);
        GD.approve(address(shop), 25 ether);
        shop.buy(101, 1, 25 ether);
        GD.approve(address(arcade), 1 ether);
        arcade.play(1 ether);
        GD.approve(address(t), 10 ether);
        t.enter(id);
        t.submitScore(id, 500);
        vm.stopPrank();
        assertEq(GD.balanceOf(treasury), 26 ether);
        assertEq(GD.balanceOf(address(t)), t.liabilities());

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(id, player, uint128(10 ether)))));
        vm.warp(block.timestamp + 1 days);
        t.postResults(id, leaf, 10 ether);
        uint256 before = GD.balanceOf(player);
        vm.prank(player);
        t.claim(id, 10 ether, new bytes32[](0));
        assertEq(GD.balanceOf(player), before + 10 ether);
        assertEq(t.liabilities(), 0);
    }

    function test_realGoodDollarPlayFeesFundPrizePool() public {
        SlyceArcade arcade = SlyceArcade(address(new ERC1967Proxy(address(new SlyceArcade()), abi.encodeCall(SlyceArcade.initialize, (GD, treasury, address(this), 1 ether)))));
        SlyceTournament t = SlyceTournament(address(new ERC1967Proxy(address(new SlyceTournament()), abi.encodeCall(SlyceTournament.initialize, (GD, treasury, address(this))))));
        t.setArcade(address(arcade));
        arcade.setPrizePool(address(t));
        uint256 id = t.createTournament(uint64(block.timestamp), uint64(block.timestamp + 1 days), 0, 0);
        t.setPrizeTournament(id);
        vm.startPrank(player);
        GD.approve(address(arcade), 3 ether);
        uint256 gasBefore = gasleft();
        arcade.play(1 ether);
        emit log_named_uint("real G$ play gas (prize routing)", gasBefore - gasleft());
        arcade.play(1 ether);
        arcade.play(1 ether);
        vm.stopPrank();
        assertEq(t.getTournament(id).pool, 3 ether);
        assertEq(GD.balanceOf(address(t)), t.liabilities());
    }
}
