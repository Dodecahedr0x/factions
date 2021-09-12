//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

import "./IRarityAttributes.sol";
import "./IFactions.sol";

/// @dev Factions let summoners form groups
contract Factions is IFactions {
    address private _owner;
    uint private _factionChangeDelay = 1 weeks;

    function owner() external view override returns (address) {
        return _owner;
    }

    function factionChangeDelay() external view override returns (uint) {
        return _factionChangeDelay;
    }

    constructor() {
        _owner = msg.sender;
    }

    function setFactionChangeDelay(uint delay) external override {
        require(msg.sender == _owner, "Factions: owner");
        _factionChangeDelay = delay;
    }

    function setOwner(address newOwner) external override {
        require(msg.sender == _owner, "Factions: owner");
        _owner = newOwner;
    }
    
    IRarityAttributes constant _attributes = IRarityAttributes(0xB5F5AF1087A8DA62A23b08C00C6ec9af21F397a1);

    /// @dev _enrollments describe the faction the summoner joined
    /// @param faction is the index of the faction joined
    /// @param date is the date the summoner joined
    struct Enrollment {
        uint8 faction;
        uint date;
    }

    mapping(uint => Enrollment) public _enrollments;
    uint[5] public _enrolled;

    function enrollments(uint summoner) external view override returns(uint8, uint) {
        Enrollment memory enrollment = _enrollments[summoner];
        return (enrollment.faction, enrollment.date);
    }

    function enrolled(uint8 faction) external view override returns (uint) {
        require(1 <= faction && faction <= 5, "Factions: bad index");
        return _enrolled[faction - 1];
    }

    function factionName(uint index) public pure override returns (string memory) {
        if(index == 1) return "The Harpers";
        else if(index == 2) return "The Order of the Gauntlet";
        else if(index == 3) return "The Emerald Enclave";
        else if(index == 4) return "The Lords' Alliance";
        else if(index == 5) return "The Zhentarim";
        else return "None";
    }

    /// @dev Enrolls a summoner in a faction
    /// @param summoner Summoner ID
    /// @param faction The index of the faction
    function enroll(uint summoner, uint8 faction) external override {
        require(1 <= faction && faction <= 5, "Factions: bad index");
        require(_attributes.character_created(summoner), "Factions: character not created");

        Enrollment memory pastEnrollment = _enrollments[summoner];
        require(pastEnrollment.date + _factionChangeDelay < block.timestamp, "Factions: changing too fast");

        if(pastEnrollment.faction != 0)
            _enrolled[pastEnrollment.faction - 1]--;

        Enrollment memory enrollment = Enrollment({
            faction: faction,
            date: block.timestamp
        });

        _enrollments[summoner] = enrollment;
        _enrolled[faction - 1]++;
    }
}
