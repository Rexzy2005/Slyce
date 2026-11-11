// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SlyceShop} from "../src/SlyceShop.sol";

/// Lists the premium cosmetics shown in apps/web/src/features/catalog.ts (owner only). One per wallet each.
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
        vm.stopBroadcast();
        console.log("Listed 10 cosmetics on", address(shop));
    }
}
