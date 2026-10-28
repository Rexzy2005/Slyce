// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SlyceTournament} from "../src/SlyceTournament.sol";

/// Env: TOURNAMENT (proxy), ENTRY_FEE (G$ wei), DURATION (seconds, default 1 day), MAX_ENTRANTS (default 0 = unlimited).
/// Starts a minute from now so the transaction can't land after `startTime`. Set PRIZE=1 (default) to make it the
/// prize tournament that receives play fees.
contract CreateTournament is Script {
    function run() external returns (uint256 id) {
        SlyceTournament tournament = SlyceTournament(vm.envAddress("TOURNAMENT"));
        uint64 start = uint64(block.timestamp + 60);
        uint64 end = start + uint64(vm.envOr("DURATION", uint256(1 days)));
        vm.startBroadcast();
        id = tournament.createTournament(start, end, uint128(vm.envOr("ENTRY_FEE", uint256(0))), uint32(vm.envOr("MAX_ENTRANTS", uint256(0))));
        if (vm.envOr("PRIZE", uint256(1)) == 1) tournament.setPrizeTournament(id);
        vm.stopBroadcast();
        console.log("Tournament id", id);
    }
}
