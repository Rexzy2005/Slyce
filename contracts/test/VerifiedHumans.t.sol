// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SlyceTournament} from "../src/SlyceTournament.sol";
import {SlyceTest} from "./utils/SlyceTest.sol";

contract MockIdentity {
    mapping(address => address) public roots;

    function verify(address account, address root) external {
        roots[account] = root;
    }

    function getWhitelistedRoot(address account) external view returns (address) {
        return roots[account];
    }
}

contract VerifiedHumansTest is SlyceTest {
    SlyceTournament t;
    MockIdentity identity = new MockIdentity();
    uint256 id;

    function setUp() public override {
        super.setUp();
        t = deployTournament(IERC20(address(token)));
        vm.startPrank(owner);
        t.setIdentity(address(identity));
        id = t.createTournament(uint64(block.timestamp), uint64(block.timestamp + 1 days), 0, 0);
        vm.stopPrank();
    }

    function test_unverifiedWalletCannotEnter() public {
        vm.prank(alice);
        vm.expectRevert(SlyceTournament.NotVerifiedHuman.selector);
        t.enter(id);
    }

    function test_verifiedHumanEntersOncePerIdentity() public {
        identity.verify(alice, alice);
        identity.verify(bob, alice); // bob is a wallet linked to alice's identity
        vm.prank(alice);
        t.enter(id);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SlyceTournament.HumanAlreadyEntered.selector, id, alice));
        t.enter(id);
        identity.verify(carol, carol);
        vm.prank(carol);
        t.enter(id);
        assertEq(t.getTournament(id).entrants, 2);
    }

    function test_gateCanBeDisabledByOwner() public {
        vm.prank(owner);
        t.setIdentity(address(0));
        vm.prank(alice);
        t.enter(id);
        assertTrue(t.entered(id, alice));
    }
}
