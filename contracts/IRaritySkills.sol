//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IRaritySkills {
    function set_skills(uint _summoner, uint8[36] memory _skills) external;
    function get_skills(uint _summoner) external view returns (uint8[36] memory);
}