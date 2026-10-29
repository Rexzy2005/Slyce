// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SlyceTournament} from "../src/SlyceTournament.sol";
import {SlyceArcade} from "../src/SlyceArcade.sol";

/// Upgrades the live Tournament and Arcade proxies to v1.3.0 and turns on automatic tournaments.
/// Env: TOURNAMENT, ARCADE (proxies), AUTO_DURATION (seconds, default 1 day).
contract EnableAutoRoll is Script {
    function run() external {
        SlyceTournament tournament = SlyceTournament(vm.envAddress("TOURNAMENT"));
        SlyceArcade arcade = SlyceArcade(vm.envAddress("ARCADE"));
        uint64 duration = uint64(vm.envOr("AUTO_DURATION", uint256(1 days)));
        vm.startBroadcast();
        tournament.upgradeToAndCall(address(new SlyceTournament()), "");
        arcade.upgradeToAndCall(address(new SlyceArcade()), "");
        tournament.setAutoRoll(duration);
        vm.stopBroadcast();
        console.log("Tournament", tournament.version(), "auto-roll seconds", duration);
        console.log("Arcade", arcade.version());
    }
}
