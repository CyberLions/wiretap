const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3001/api';
const TEST_TOKEN = 'your-test-token-here'; // Replace with actual test token

async function testTeamMemberCounts() {
  try {
    console.log('Testing team member counts...\n');
    
    // Test 1: Get all teams and check member counts
    console.log('1. Fetching all teams...');
    const teamsResponse = await axios.get(`${BASE_URL}/teams`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });
    
    const teams = teamsResponse.data;
    console.log(`Found ${teams.length} teams`);
    
    teams.forEach(team => {
      console.log(`Team: ${team.name} (ID: ${team.id})`);
      console.log(`  - Member count: ${team.member_count || 0}`);
      console.log(`  - Instance count: ${team.instance_count || 0}`);
      console.log(`  - Workshop: ${team.workshop_name || 'Unknown'}`);
      console.log('');
    });
    
    // Test 2: Get individual team details
    if (teams.length > 0) {
      const firstTeam = teams[0];
      console.log(`2. Fetching details for team: ${firstTeam.name}...`);
      
      const teamResponse = await axios.get(`${BASE_URL}/teams/${firstTeam.id}`, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });
      
      const teamDetails = teamResponse.data;
      console.log(`Team details for ${teamDetails.name}:`);
      console.log(`  - Member count: ${teamDetails.member_count || 0}`);
      console.log(`  - Instance count: ${teamDetails.instance_count || 0}`);
      console.log(`  - Workshop: ${teamDetails.workshop_name || 'Unknown'}`);
      console.log('');
    }
    
    console.log('✅ Team member count tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testTeamMemberCounts();
