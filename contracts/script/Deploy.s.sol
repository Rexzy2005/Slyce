// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SlyceShop} from "../src/SlyceShop.sol";
import {SlyceTournament} from "../src/SlyceTournament.sol";
import {SlyceArcade} from "../src/SlyceArcade.sol";

/// Deploys every contract behind a UUPS (ERC-1967) proxy and lists the shop catalog
/// (item ids must match apps/web/src/features/catalog.ts).
/// Env: GD_TOKEN, TREASURY, PLAY_FEE (G$ wei, default 1 G$), IDENTITY (GoodDollar Identity; recommended),
/// OWNER (optional; must later call acceptOwnership()).
contract Deploy is Script {
    function run() external returns (SlyceShop shop, SlyceTournament tournament, SlyceArcade arcade) {
        IERC20 token = IERC20(vm.envAddress("GD_TOKEN"));
        address treasury = vm.envAddress("TREASURY");
        uint128 playFee = uint128(vm.envOr("PLAY_FEE", uint256(1 ether)));
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        address owner = vm.envOr("OWNER", deployer);

        shop = SlyceShop(address(new ERC1967Proxy(address(new SlyceShop()), abi.encodeCall(SlyceShop.initialize, (token, treasury, deployer)))));
        // Cosmetic blade trails, one per wallet. G$ has 18 decimals; change later with setItem.
        shop.setItem(101, 100 ether, 1, true); // Ember blade
        shop.setItem(102, 100 ether, 1, true); // Sky blade
        shop.setItem(103, 150 ether, 1, true); // Leaf blade
        tournament = SlyceTournament(address(new ERC1967Proxy(address(new SlyceTournament()), abi.encodeCall(SlyceTournament.initialize, (token, treasury, deployer)))));
        arcade = SlyceArcade(address(new ERC1967Proxy(address(new SlyceArcade()), abi.encodeCall(SlyceArcade.initialize, (token, treasury, deployer, playFee)))));
        // Every paid round grows the open daily prize pool (see CreateTournament.s.sol).
        tournament.setArcade(address(arcade));
        arcade.setPrizePool(address(tournament));
        // Only GoodDollar-verified humans can enter prize tournaments (production Identity: docs/research/gooddollar.md).
        address identity = vm.envOr("IDENTITY", address(0));
        if (identity != address(0)) tournament.setIdentity(identity);
        if (owner != deployer) {
            shop.transferOwnership(owner);
            tournament.transferOwnership(owner);
            arcade.transferOwnership(owner);
        }
        vm.stopBroadcast();
        console.log("SlyceShop proxy      ", address(shop));
        console.log("SlyceTournament proxy", address(tournament));
        console.log("SlyceArcade proxy    ", address(arcade));
        if (owner != deployer) console.log("Pending owner must call acceptOwnership() on all three:", owner);
    }
}
