//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

interface IFactions {
    function owner() external view returns (address);
    function factionChangeDelay() external view returns (uint);

    function setFactionChangeDelay(uint delay) external;
    function setOwner(address newOwner) external;

    function enrollments(uint summoner) external view returns (uint8, uint);
    function enrolled(uint8 faction) external view returns (uint);

    function factionName(uint index) external pure returns (string memory);
    function enroll(uint summoner, uint8 faction) external;
}
