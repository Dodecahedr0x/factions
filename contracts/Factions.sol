//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "hardhat/console.sol";

interface rarity {
    function summon(uint _class) external;
    function level(uint) external view returns (uint);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

interface attributes {
    function point_buy(uint _summoner, uint32 _str, uint32 _dex, uint32 _const, uint32 _int, uint32 _wis, uint32 _cha) external;
    function character_created(uint) external view returns (bool);
    function ability_scores(uint) external view returns (uint32,uint32,uint32,uint32,uint32,uint32);
}

interface codex_skills {
    function skill_by_id(uint) external view returns (
        uint id,
        string memory name,
        uint attribute_id,
        uint synergy,
        bool retry,
        bool armor_check_penalty,
        string memory check,
        string memory action
    );
}

interface rarity_skills {
    function get_skills(uint _summoner) external view returns (uint8[36] memory);
}

/// @dev Factions let summoners form groups of their most skilled adventurers to fight other factions
contract Factions {
    using EnumerableSet for EnumerableSet.UintSet;

    uint public constant TRIBUTE = 10 ** 17;
    
    rarity public constant _rarity =  rarity(0xce761D788DF608BD21bdd59d6f4B54b2e27F25Bb);
    attributes constant _attributes = attributes(0xB5F5AF1087A8DA62A23b08C00C6ec9af21F397a1);
    rarity_skills  public constant _skills = rarity_skills(0x6292f3fB422e393342f257857e744d43b1Ae7e70);
    codex_skills constant _codex_skills = codex_skills(0x67ae39a2Ee91D7258a86CD901B17527e19E493B3);

    /// @dev Enrollments describe the faction the summoner joined
    /// @param faction is the index of the faction joined
    /// @param date is the date the summoner joined
    /// @param collected is the reverse amount of collected tributes
    struct Enrollment {
        uint8 faction;
        uint date;
        uint collected;
    }
 
    /// @dev Amount collected as tributes by each faction
    uint[5] public totalTributes;
    /// @dev Amounts collected by each faction for summoner training
    uint[5] public treasuries;
    mapping(uint => Enrollment) public enrollments;

    mapping(address => EnumerableSet.UintSet) ownedSummoners;
    mapping(uint => bool) public readyMembers;
    uint[5] public numberOfMembersReady;
    uint[5][36] public factionSkills;
    uint public lastClash;
    mapping(uint => uint[36]) private _skillsWhenReady;

    constructor() {}

    receive() external payable {}

    function factionName(uint index) public pure returns (string memory) {
        if(index == 1) return "The Harpers";
        else if(index == 2) return "The Order of the Gauntlet";
        else if(index == 3) return "The Emeral Enclave";
        else if(index == 4) return "The Loard's Alliance";
        else if(index == 5) return "The Order of the Gauntlet";
        else return "None";
    }

    /// @dev Enrolls a summoner in a faction
    /// @param summoner Summoner ID
    /// @param faction The index of the faction
    function enroll(uint summoner, uint8 faction) external {
        require(_attributes.character_created(summoner), "Factions: summoner does not exist");
        require(enrollments[summoner].date + 1 weeks < block.timestamp, "Factions: changing too fast");

        Enrollment memory enrollment = Enrollment({
            faction: faction,
            date: block.timestamp,
            collected: totalTributes[faction]
        });

        enrollments[summoner] = enrollment;
    }

    /// @dev Sends one summoner to fight for the faction. Needs approval
    /// @param summoner Summoner ID
    function readyOneSummoner(uint summoner) public payable {
        Enrollment memory enrollment = enrollments[summoner];
        require(enrollment.date > 0, "Factions: not enrolled");
        require(msg.value >= TRIBUTE, "Factions: did not pay tribute");

        numberOfMembersReady[enrollment.faction]++;
        ownedSummoners[msg.sender].add(summoner);

        uint8[36] memory summonerSkills = _skills.get_skills(summoner);
        uint[36] memory boostedSummonerSkills;
        uint level = _rarity.level(summoner);
        for(uint i=0; i<36; i++) {
            (,, uint attribute_id,,,,,) = _codex_skills.skill_by_id(i);
            (uint32 str, uint32 dex,uint32 con, uint32 intel, uint32 wis, uint32 cha) = _attributes.ability_scores(summoner);

            if(attribute_id == 1) {
                boostedSummonerSkills[i] = uint(summonerSkills[i]) * level * uint(str);
            } else if(attribute_id == 2) {
                boostedSummonerSkills[i] = uint(summonerSkills[i]) * level * uint(dex);
            } else if(attribute_id == 3) {
                boostedSummonerSkills[i] = uint(summonerSkills[i]) * level * uint(con);
            } else if(attribute_id == 4) {
                boostedSummonerSkills[i] = uint(summonerSkills[i]) * level * uint(intel);
            } else if(attribute_id == 5) {
                boostedSummonerSkills[i] = uint(summonerSkills[i]) * level * uint(wis);
            } else if(attribute_id == 6) {
                boostedSummonerSkills[i] = uint(summonerSkills[i]) * level * uint(cha);
            }

            factionSkills[enrollment.faction][i] += boostedSummonerSkills[i];
        }
        _skillsWhenReady[summoner] = boostedSummonerSkills;

        _rarity.transferFrom(msg.sender, address(this), summoner);
    }

    /// @dev Retrieve a sent summoner
    /// @param summoner Summoner ID
    function retrieveOneSummoner(uint summoner) public {
        require(ownedSummoners[msg.sender].contains(summoner), "Factions: not owned");

        uint8 faction = enrollments[summoner].faction;

        numberOfMembersReady[faction]--;
        ownedSummoners[msg.sender].remove(summoner);

        uint[36] memory summonerSkills = _skillsWhenReady[summoner];
        for(uint i=0; i<36; i++) {
            factionSkills[faction][i] -= summonerSkills[i];
        }

        _rarity.transferFrom(address(this), msg.sender, summoner);
    }

    /// @dev Sends many summoner to fight for the faction.
    /// @param summoners Summoners ID
    function readyManySummoner(uint[] calldata summoners) public payable {
        uint len = summoners.length;
        require(msg.value >= TRIBUTE * len, "Factions: did not pay tribute");
        for (uint i = 0; i < len; i++) {
            readyOneSummoner(summoners[i]);
        }
    }

    /// @dev Retrieve many sent summoner
    /// @param summoners Summoner ID
    function retrieveManySummoner(uint[] calldata summoners) public {
        uint len = summoners.length;
        for (uint i = 0; i < len; i++) {
            retrieveOneSummoner(summoners[i]);
        }
    }

    /// @dev Retrieve number of summoners ready belonging to player
    function getOwnedSummonerAtIndex(address player) public view returns (uint number) {
        return ownedSummoners[player].length();
    }

    /// @dev ID of a sent summoner
    function getOwnedSummonerAtIndex(address player, uint index) public view returns (uint summoner) {
        return ownedSummoners[player].at(index);
    }

    /// @dev Retrieve a sent summoner
    function factionPower(uint8 faction) public view returns (uint power) {
        for(uint i=0; i<36; i++) {
            (,,, uint synergy,,,,) = _codex_skills.skill_by_id(i);

            if(synergy != 0)
                power += factionSkills[faction][i] + factionSkills[faction][synergy];
            else
                power += factionSkills[faction][i];
        }
    }

    /// @dev Starts a clash
    function startClash() public {
        require(lastClash + 1 days < block.timestamp, "Factions: too early to clash");
        lastClash = block.timestamp;
        
        uint8 winner;
        uint maxPower;

        for(uint8 i=0; i<5; i++) {
            uint power = factionPower(i);
            if(maxPower < power) {
                winner = i;
                maxPower = power;
            }
        }

        uint wonAmount;
        for(uint8 i=0; i<5; i++) {
            if(i != winner) {
                wonAmount += treasuries[i];
                treasuries[i] = 0;
            }
        }
        treasuries[winner] += wonAmount;
        totalTributes[winner] += wonAmount;
    }

    /// @dev Receive the share of tribute for a summoner
    /// @param summoner Summoner ID
    function retrieveOneTributeShare(uint summoner) public {
        require(ownedSummoners[msg.sender].contains(summoner), "Factions: summoner not owned");

        Enrollment memory enrollment = enrollments[summoner];
        uint amountReceived = (totalTributes[enrollment.faction] - enrollment.collected) / numberOfMembersReady[enrollment.faction];

        enrollments[summoner].collected = totalTributes[enrollment.faction];
        payable(msg.sender).transfer(amountReceived);
    }

    /// @dev Receive the share of tribute for many summoner
    /// @param summoners Summoners IDs
    function retrieveManyTributeShare(uint[] calldata summoners) public {
        uint len = summoners.length;
        for (uint i = 0; i < len; i++) {
            retrieveOneTributeShare(summoners[i]);
        }
    }
}
