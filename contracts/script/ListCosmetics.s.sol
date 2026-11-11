// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SlyceShop} from "../src/SlyceShop.sol";

/// Lists the shop items added in apps/web/src/features/catalog.ts (owner only): cosmetics are one per wallet;
/// the extra-lives pack (401, 3 lives, ADR-0016) can be bought again and again.
/// Env: SHOP (proxy). Prices are in G$ (18 decimals); change any item later with setItem.
contract ListCosmetics is Script {
    function run() external {
        SlyceShop shop = SlyceShop(vm.envAddress("SHOP"));
        vm.startBroadcast();
        shop.setItem(104, 500 ether, 1, true); // Rainbow blade
        shop.setItem(105, 500 ether, 1, true); // Lightning blade
        shop.setItem(106, 400 ether, 1, true); // Gold blade
        shop.setItem(107, 300 ether, 1, true); // Shadow blade
        shop.setItem(201, 250 ether, 1, true); // Golden fruit
        shop.setItem(202, 250 ether, 1, true); // Neon fruit
        shop.setItem(203, 250 ether, 1, true); // Frost fruit
        shop.setItem(301, 200 ether, 1, true); // Marble board
        shop.setItem(302, 200 ether, 1, true); // Midnight board
        shop.setItem(303, 300 ether, 1, true); // Bamboo board
        shop.setItem(401, 300 ether, 0, true); // 3 extra lives (100 G$ each), unlimited purchases
        vm.stopBroadcast();
        console.log("Listed 11 shop items on", address(shop));
    }
}
