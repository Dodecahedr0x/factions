//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

interface IBattlefield {
    function owner() external view returns (address);
    function tribute() external view returns (uint);
    function clashDelay() external view returns (uint);

    function setTribute(uint tribute) external;
    function setClashDelay(uint delay) external;
    function setOwner(address newOwner) external;
 
    function treasury(uint8 faction) external view returns (uint treasury);
    function summonersOnTheField(uint8 faction) external view returns (uint number);
    function availableToCollect(uint summoner) external view returns (uint amount);

    function readyOneSummoner(uint summoner) external payable;
    function retrieveOneSummoner(uint summoner) external;
    function readyManySummoners(uint[] calldata summoners) external payable;
    function retrieveManySummoners(uint[] calldata summoners) external;

    function getOwnedSummoners(address player) external view returns (uint number);
    function getOwnedSummonerAtIndex(address player, uint index) external view returns (uint summoner);

    function factionPower(uint8 faction) external view returns (uint power);
    function powerIncrease(uint summoner) external view returns (uint power);
    function startClash() external;
    function nextClash() external view returns (uint date);
    function lastWinner() external view returns (uint8 faction);

    function receiveOneTributeShare(uint summoner) external;
    function receiveManyTributeShares(uint[] calldata summoners) external;
}
