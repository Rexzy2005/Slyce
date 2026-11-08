// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SlyceArcade} from "../src/SlyceArcade.sol";
import {SlyceTournament} from "../src/SlyceTournament.sol";
import {SlyceBase} from "../src/SlyceBase.sol";
import {SlyceTest} from "./utils/SlyceTest.sol";

/// Backend-signed scores with one-time tickets (ADR-0015).
contract SignedScoresTest is SlyceTest {
    SlyceArcade arcade;
    SlyceTournament tournament;
    uint256 signerKey = 0xA11CE;
    address signer = vm.addr(0xA11CE);
    uint256 id;

    function setUp() public override {
        super.setUp();
        vm.warp(1_800_000_000);
        arcade = deployArcade(IERC20(address(token)), 0);
        tournament = deployTournament(IERC20(address(token)));
        vm.startPrank(owner);
        arcade.setGameRules(100_000, 0);
        id = tournament.createTournament(uint64(block.timestamp), uint64(block.timestamp + 1 days), 0, 0);
        vm.stopPrank();
        vm.prank(alice);
        tournament.enter(id);
    }

    function enableSigning() internal {
        vm.startPrank(owner);
        arcade.setScoreSigner(signer);
        tournament.setScoreSigner(signer);
        vm.stopPrank();
    }

    function sign(uint256 key, bytes32 domain, bytes32 structHash) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, MessageHashUtils.toTypedDataHash(domain, structHash));
        return abi.encodePacked(r, s, v);
    }

    function gameSig(uint256 key, address player, uint256 ticket, uint32 score, uint64 deadline) internal view returns (bytes memory) {
        return sign(key, arcade.scoreDomainSeparator(), keccak256(abi.encode(arcade.GAME_TYPEHASH(), player, ticket, score, uint32(3), uint32(10), deadline)));
    }

    function scoreSig(address player, uint256 ticket, uint32 score, uint64 deadline) internal view returns (bytes memory) {
        return sign(signerKey, tournament.scoreDomainSeparator(), keccak256(abi.encode(tournament.SCORE_TYPEHASH(), player, id, ticket, score, deadline)));
    }

    function test_unsignedScoresWorkUntilASignerIsSet() public {
        vm.prank(alice);
        arcade.submitGame(600, 3, 10);
        vm.prank(alice);
        tournament.submitScore(id, 600);
        assertEq(tournament.bestScore(id, alice), 600);
    }

    function test_signerIsOwnerOnlyAndRequiresSignatures() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        arcade.setScoreSigner(alice);
        enableSigning();
        assertEq(arcade.scoreSigner(), signer);
        vm.expectRevert(SlyceBase.SignatureRequired.selector);
        vm.prank(alice);
        arcade.submitGame(600, 3, 10);
        vm.expectRevert(SlyceBase.SignatureRequired.selector);
        vm.prank(alice);
        tournament.submitScore(id, 600);
    }

    function test_signedGameIsRecordedOncePerTicket() public {
        enableSigning();
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = gameSig(signerKey, alice, 7, 600, deadline);
        vm.prank(alice);
        arcade.submitSignedGame(600, 3, 10, 7, deadline, sig);
        assertEq(arcade.playerStats(alice).bestScore, 600);
        assertTrue(arcade.ticketUsed(7));
        vm.expectRevert(abi.encodeWithSelector(SlyceBase.TicketUsed.selector, 7));
        vm.prank(alice);
        arcade.submitSignedGame(600, 3, 10, 7, deadline, sig);
    }

    function test_rejectsTamperedWrongSignerOtherPlayerAndExpired() public {
        enableSigning();
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = gameSig(signerKey, alice, 7, 600, deadline);
        vm.expectRevert(SlyceBase.InvalidScoreSignature.selector);
        vm.prank(alice);
        arcade.submitSignedGame(6000, 3, 10, 7, deadline, sig);
        vm.expectRevert(SlyceBase.InvalidScoreSignature.selector);
        vm.prank(bob);
        arcade.submitSignedGame(600, 3, 10, 7, deadline, sig);
        bytes memory forged = gameSig(0xB0B, alice, 8, 600, deadline);
        vm.expectRevert(SlyceBase.InvalidScoreSignature.selector);
        vm.prank(alice);
        arcade.submitSignedGame(600, 3, 10, 8, deadline, forged);
        vm.warp(deadline + 1);
        vm.expectRevert(abi.encodeWithSelector(SlyceBase.SignatureExpired.selector, deadline));
        vm.prank(alice);
        arcade.submitSignedGame(600, 3, 10, 7, deadline, sig);
    }

    function test_signedTournamentScoreAndSameTicketOnBothContracts() public {
        enableSigning();
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.startPrank(alice);
        arcade.submitSignedGame(900, 3, 10, 42, deadline, gameSig(signerKey, alice, 42, 900, deadline));
        tournament.submitSignedScore(id, 900, 42, deadline, scoreSig(alice, 42, 900, deadline));
        vm.stopPrank();
        assertEq(tournament.bestScore(id, alice), 900);
        // A signature for one tournament cannot be replayed on another.
        vm.prank(owner);
        uint256 other = tournament.createTournament(uint64(block.timestamp), uint64(block.timestamp + 1 days), 0, 0);
        vm.prank(alice);
        tournament.enter(other);
        bytes memory sig = scoreSig(alice, 43, 950, deadline);
        vm.expectRevert(SlyceBase.InvalidScoreSignature.selector);
        vm.prank(alice);
        tournament.submitSignedScore(other, 950, 43, deadline, sig);
    }

    function test_signedScoresRejectedWhileSigningIsOff() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = gameSig(signerKey, alice, 7, 600, deadline);
        vm.expectRevert(SlyceBase.SignedScoresDisabled.selector);
        vm.prank(alice);
        arcade.submitSignedGame(600, 3, 10, 7, deadline, sig);
    }

    function test_turningSigningOffRestoresUnsignedScores() public {
        enableSigning();
        vm.prank(owner);
        arcade.setScoreSigner(address(0));
        vm.prank(alice);
        arcade.submitGame(600, 3, 10);
        assertEq(arcade.playerStats(alice).games, 1);
    }

    /// Signatures produced by the backend's ScoreSigningService (viem) for this test's deployment are accepted.
    function test_acceptsSignaturesFromTheBackendSigner() public {
        assertEq(address(arcade), 0xF62849F9A0B5Bf2913b396098F7c7019b51A820a);
        assertEq(address(tournament), 0xc7183455a4C133Ae270771860664b6B7ec320bB1);
        assertEq(id, 1);
        enableSigning();
        uint256 ticket = 151715689249632577162852032373152442979;
        uint64 deadline = 1800003660;
        vm.startPrank(alice);
        arcade.submitSignedGame(600, 3, 57, ticket, deadline, hex"ccd03bb3a0013213569aa3e23c5fb25cd35218823528295dc35d0ec7cccd147a5cafb09374198575573adf2481ba196f80aae1530557202f70d112639c432bba1c");
        tournament.submitSignedScore(id, 600, ticket, deadline, hex"855385aad5d11e53e6a404415af5ae157282d53aa7f7b4413bc5737d45a0f75c4aabd5cfe9a6e66ffee2288f9f99e68b9475e73195ffebaffab5d9af2d79d53c1b");
        vm.stopPrank();
        assertEq(arcade.playerStats(alice).bestScore, 600);
        assertEq(tournament.bestScore(id, alice), 600);
    }
}
