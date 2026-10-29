// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SlyceTournament} from "../src/SlyceTournament.sol";
import {SlyceArcade} from "../src/SlyceArcade.sol";

/// Upgrades the live proxies to free-to-play game records (Arcade v2.0) and automatic bounties
/// (Tournament v1.3), then configures them. Env: TOURNAMENT, ARCADE, IDENTITY,
/// AUTO_DURATION (default 1 day), FUND (G$ wei to add to the reward pot, default 0; owner must hold it).
contract SeasonUpgrade is Script {
    function run() external {
        SlyceTournament tournament = SlyceTournament(vm.envAddress("TOURNAMENT"));
        SlyceArcade arcade = SlyceArcade(vm.envAddress("ARCADE"));
        address identity = vm.envAddress("IDENTITY");
        uint64 duration = uint64(vm.envOr("AUTO_DURATION", uint256(1 days)));
        uint128 fund = uint128(vm.envOr("FUND", uint256(0)));

        uint32[] memory scores = new uint32[](4);
        uint128[] memory rewards = new uint128[](4);
        (scores[0], scores[1], scores[2], scores[3]) = (500, 1000, 2500, 5000);
        (rewards[0], rewards[1], rewards[2], rewards[3]) = (5 ether, 15 ether, 40 ether, 100 ether);

        vm.startBroadcast();
        if (keccak256(bytes(tournament.version())) != keccak256("1.3.0")) {
            tournament.upgradeToAndCall(address(new SlyceTournament()), "");
        }
        tournament.setAutoRoll(duration);
        arcade.upgradeToAndCall(address(new SlyceArcade()), "");
        arcade.setPlayFee(0); // free to play
        arcade.setIdentity(identity);
        arcade.setGameRules(100_000, 20);
        arcade.setMilestones(scores, rewards);
        if (fund != 0) {
            arcade.token().approve(address(arcade), fund);
            arcade.fundRewards(fund);
        }
        vm.stopBroadcast();
        console.log("Tournament", tournament.version(), "auto seconds", duration);
        console.log("Arcade", arcade.version(), "reward pot", arcade.rewardBudget());
    }
}
