//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./EnumerableSet.sol";
import "./IBattlefield.sol";
import "./IRarity.sol";
import "./IRarityAttributes.sol";
import "./IRaritySkills.sol";
import "./IRaritySkillsCodex.sol";
import "./Factions.sol";

/// @dev Battlefields are places where faction members gather to fight
contract HillBattlefield is IBattlefield {
    using EnumerableSet for EnumerableSet.UintSet;

    address private _owner;
    uint private _tribute = 10 ** 17;
    uint private _clashDelay = 1 days;

    function owner() external view override returns (address) {
        return _owner;
    }

    function tribute() external view override returns (uint) {
        return _tribute;
    }

    function clashDelay() external view override returns (uint) {
        return _clashDelay;
    }

    function setTribute(uint newTribute) external override {
        require(msg.sender == _owner, "Factions: owner");
        _tribute = newTribute;
    }

    function setClashDelay(uint newClashDelay) external override {
        require(msg.sender == _owner, "Factions: owner");
        _clashDelay = newClashDelay;
    }

    function setOwner(address newOwner) external override {
        require(msg.sender == _owner, "Factions: owner");
        _owner = newOwner;
    }
    
    IRarity public constant _rarity =  IRarity(0xce761D788DF608BD21bdd59d6f4B54b2e27F25Bb);
    IRarityAttributes constant _attributes = IRarityAttributes(0xB5F5AF1087A8DA62A23b08C00C6ec9af21F397a1);
    IRaritySkills  public constant _skills = IRaritySkills(0x51C0B29A1d84611373BA301706c6B4b72283C80F);
    IRaritySkillsCodex constant _codex_skills = IRaritySkillsCodex(0x67ae39a2Ee91D7258a86CD901B17527e19E493B3);
    Factions public _factions;

    constructor(address factions) {
        _owner = msg.sender;
        _factions = Factions(factions);
    }

    receive() external payable {}

    /// @dev Enrollments describe the faction the summoner joined
    /// @param faction is the index of the faction joined
    /// @param date is the date the summoner joined
    struct Enrollment {
        uint8 faction;
        uint date;
    }
 
    /// @dev Amount collected as tributes by each faction
    uint[5] private _totalTributes;
    /// @dev Amounts collected by each faction for summoner training
    uint[5] private _treasuries;
    /// @dev Timestamp of the last clash a summoner collected
    mapping(uint => uint) private _collected;

    mapping(address => EnumerableSet.UintSet) ownedSummoners;
    uint[5] public numberOfMembersReady;
    uint[36][5] private _factionSkills;
    uint private _nextClash;
    uint8 private _lastWinner;
    mapping(uint => uint[36]) private _skillsWhenReady;

    function treasury(uint8 faction) external view override returns (uint) {
        require(1 <= faction && faction <= 5, "HillBF: index");
        return _treasuries[faction - 1];
    }
    function summonersOnTheField(uint8 faction) external view override returns (uint number) {
        require(1 <= faction && faction <= 5, "HillBF: index");
        return numberOfMembersReady[faction - 1];
    }
    function availableToCollect(uint summoner) external view override returns (uint amount) {
        if(_collected[summoner] >= _nextClash) return 0;

        (uint8 faction, ) = _factions.enrollments(summoner);
        uint factionIndex = faction - 1;
        return _totalTributes[factionIndex] / numberOfMembersReady[factionIndex];
    }

    /// @dev Sends one summoner to fight for the faction. Needs approval
    /// @param summoner Summoner ID
    function readyOneSummoner(uint summoner) public override payable {
        (uint8 faction, uint date) = _factions.enrollments(summoner);
        require(date > 0, "HillBF: enrolled");
        require(msg.value >= _tribute, "HillBF: tribute");

        uint factionIndex = faction - 1;
        numberOfMembersReady[factionIndex]++;
        _treasuries[factionIndex] += _tribute;
        _collected[summoner] = _nextClash;
        ownedSummoners[msg.sender].add(summoner);

        { // stack too deep
        uint8[36] memory summonerSkills = _skills.get_skills(summoner);
        uint[36] memory boostedSummonerSkills;
        uint level = _rarity.level(summoner);
        (uint32 str, uint32 dex, uint32 con, uint32 intel, uint32 wis, uint32 cha) = _attributes.ability_scores(summoner);
        for(uint i=0; i<36; i++) {
            (,, uint attribute_id,,,,,) = _codex_skills.skill_by_id(i + 1);

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

            _factionSkills[factionIndex][i] += boostedSummonerSkills[i];
        }
        _skillsWhenReady[summoner] = boostedSummonerSkills;
        }

        _rarity.transferFrom(msg.sender, address(this), summoner);
    }

    /// @dev Retrieve a sent summoner
    /// @param summoner Summoner ID
    function retrieveOneSummoner(uint summoner) public override {
        require(ownedSummoners[msg.sender].contains(summoner), "HillBF: not owned");

        (uint8 faction, ) = _factions.enrollments(summoner);
        uint8 factionIndex = faction - 1;

        numberOfMembersReady[factionIndex]--;
        ownedSummoners[msg.sender].remove(summoner);

        uint[36] memory summonerSkills = _skillsWhenReady[summoner];
        for(uint i=0; i<36; i++) {
            _factionSkills[factionIndex][i] -= summonerSkills[i];
        }

        _rarity.transferFrom(address(this), msg.sender, summoner);
    }

    /// @dev Sends many summoner to fight for the faction.
    /// @param summoners Summoners ID
    function readyManySummoners(uint[] calldata summoners) public override payable {
        uint len = summoners.length;
        require(msg.value >= _tribute * len, "HillBF: no tribute");
        for (uint i = 0; i < len; i++) {
            readyOneSummoner(summoners[i]);
        }
    }

    /// @dev Retrieve many sent summoner
    /// @param summoners Summoner ID
    function retrieveManySummoners(uint[] calldata summoners) public override {
        uint len = summoners.length;
        for (uint i = 0; i < len; i++) {
            retrieveOneSummoner(summoners[i]);
        }
    }

    /// @dev Retrieve number of summoners ready belonging to player
    function getOwnedSummoners(address player) public view override returns (uint number) {
        return ownedSummoners[player].length();
    }

    /// @dev ID of a sent summoner
    function getOwnedSummonerAtIndex(address player, uint index) public view override returns (uint summoner) {
        return ownedSummoners[player].at(index);
    }

    function _power(uint[36] memory skills) internal view returns(uint power) {
        for(uint i=0; i<36; i++) {
            (,,, uint synergy,,,,) = _codex_skills.skill_by_id(i);
            if(synergy != 0)
                power += skills[i] + skills[synergy - 1];
            else
                power += skills[i];
        }
    }

    /// @dev Retrieve a sent summoner
    function factionPower(uint8 faction) external view override returns (uint power) {
        require(1 <= faction && faction <= 5, "HillBF: index");
        return _power(_factionSkills[faction - 1]);
    }

    /// @dev Gives the potential power increase of a summoner
    function powerIfAdded(uint summoner) external view override returns (uint power) {
        (uint8 faction, ) = _factions.enrollments(summoner);
        uint8 factionIndex = faction - 1;
        
        uint8[36] memory summonerSkills = _skills.get_skills(summoner);
        uint[36] memory tempSkills = _factionSkills[factionIndex];
        uint level = _rarity.level(summoner);
        (uint32 str, uint32 dex, uint32 con, uint32 intel, uint32 wis, uint32 cha) = _attributes.ability_scores(summoner);

        for(uint i=0; i<36; i++) {
            (,, uint attribute_id,,,,,) = _codex_skills.skill_by_id(i + 1);

            if(attribute_id == 1) {
                tempSkills[i] += uint(summonerSkills[i]) * level * uint(str);
            } else if(attribute_id == 2) {
                tempSkills[i] += uint(summonerSkills[i]) * level * uint(dex);
            } else if(attribute_id == 3) {
                tempSkills[i] += uint(summonerSkills[i]) * level * uint(con);
            } else if(attribute_id == 4) {
                tempSkills[i] += uint(summonerSkills[i]) * level * uint(intel);
            } else if(attribute_id == 5) {
                tempSkills[i] += uint(summonerSkills[i]) * level * uint(wis);
            } else if(attribute_id == 6) {
                tempSkills[i] += uint(summonerSkills[i]) * level * uint(cha);
            }
        }

        return _power(tempSkills);
    }

    /// @dev Starts a clash
    function startClash() public override {
        require(_nextClash < block.timestamp, "HillBF: too early");
        _nextClash = block.timestamp + _clashDelay;
        
        bool hasWinner;
        uint8 winner;
        uint maxPower;

        for(uint8 i=0; i<5; i++) {
            uint power = _power(_factionSkills[i]);
            if(maxPower < power) {
                hasWinner = true;
                winner = i;
                maxPower = power;
            } else if(maxPower == power && hasWinner) {
                hasWinner = false;
                break;
            }
        }

        if(hasWinner) {
            uint wonAmount;
            for(uint8 i=0; i<5; i++) {
                wonAmount += _treasuries[i];
                if(i != winner) {
                    _treasuries[i] = 0;
                }
            }
            _treasuries[winner] = wonAmount;
            _totalTributes[winner] = wonAmount;
            _lastWinner = winner + 1;
        } else {
            _lastWinner = 0;
        }
    }

    function nextClash() external view override returns (uint date) {
        return _nextClash;
    }
    function lastWinner() external view override returns (uint8 faction) {
        return _lastWinner;
    }

    /// @dev Receive the share of tribute for a summoner
    /// @param summoner Summoner ID
    function receiveOneTributeShare(uint summoner) public override {
        require(_collected[summoner] < _nextClash, "HillBF: nothing to collect");
        require(ownedSummoners[msg.sender].contains(summoner), "HillBF: not owned");

        (uint8 faction, ) = _factions.enrollments(summoner);
        uint factionIndex = faction - 1;
        uint amountToReceive = _totalTributes[factionIndex] / numberOfMembersReady[factionIndex];
        
        _treasuries[factionIndex] -= amountToReceive;
        _collected[summoner] = _nextClash;
        payable(msg.sender).transfer(amountToReceive);
    }

    /// @dev Receive the share of tribute for many summoner
    /// @param summoners Summoners IDs
    function receiveManyTributeShares(uint[] calldata summoners) public override {
        uint len = summoners.length;
        for (uint i = 0; i < len; i++) {
            receiveOneTributeShare(summoners[i]);
        }
    }
}
