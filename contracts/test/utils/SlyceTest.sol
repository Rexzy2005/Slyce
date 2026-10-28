// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SlyceShop} from "../../src/SlyceShop.sol";
import {SlyceTournament} from "../../src/SlyceTournament.sol";
import {SlyceArcade} from "../../src/SlyceArcade.sol";

contract MockGoodDollar is ERC20 {
    constructor() ERC20("GoodDollar", "G$") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Deploys every contract behind an ERC-1967 proxy exactly as production does.
abstract contract SlyceTest is Test {
    MockGoodDollar internal token;
    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function setUp() public virtual {
        token = new MockGoodDollar();
    }

    function deployShop(IERC20 asset) internal returns (SlyceShop) {
        address impl = address(new SlyceShop());
        return SlyceShop(address(new ERC1967Proxy(impl, abi.encodeCall(SlyceShop.initialize, (asset, treasury, owner)))));
    }

    function deployTournament(IERC20 asset) internal returns (SlyceTournament) {
        address impl = address(new SlyceTournament());
        return SlyceTournament(
            address(new ERC1967Proxy(impl, abi.encodeCall(SlyceTournament.initialize, (asset, treasury, owner))))
        );
    }

    function deployArcade(IERC20 asset, uint128 fee) internal returns (SlyceArcade) {
        address impl = address(new SlyceArcade());
        return SlyceArcade(
            address(new ERC1967Proxy(impl, abi.encodeCall(SlyceArcade.initialize, (asset, treasury, owner, fee))))
        );
    }

    function fund(address who, address spender, uint256 amount) internal {
        token.mint(who, amount);
        vm.prank(who);
        token.approve(spender, type(uint256).max);
    }
}
