const axios = require("axios");
const queryString = require("query-string");
const DynamoDB = require("aws-sdk/clients/dynamodb");
const dynamoDb = new DynamoDB.DocumentClient();

const addItemsToTeam = async (team, items) => {
  await dynamoDb
    .put({
      TableName: "opi-food-drive",
      Item: {
        ...team,
        items
      }
    })
    .promise();
};

const getTeam = async teamName => {
  const data = await dynamoDb
    .get({
      TableName: "opi-food-drive",
      Key: {
        id: teamName
      }
    })
    .promise();
  return data.Item;
};

const getAllTeams = async () => {
  const data = await dynamoDb
    .scan({
      TableName: "opi-food-drive"
    })
    .promise();
  return data.Items;
};

const sendErrorResponse = async url => {
  await axios.post(url, {
    text:
      "Unable to add items to your team. Make sure to use the format: 'add 12 items to team Food Banks'"
  });
  return {
    statusCode: 200
  };
};

const generateLeaderboard = async url => {
  const teams = await getAllTeams();
  teams.sort((a, b) => a.items < b.items);
  const trophies = ["🥇", "🥈", "🥉"];
  const teamText = teams.map(
    (team, i) => `${trophies[i] || ""} ${team.name} - ${team.items}`
  );
  await axios.post(url, {
    response_type: "in_channel",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Here's the current leaderboard! :tada: \n\n ${teamText.join(
            "\n"
          )}`
        }
      }
    ]
  });
};

module.exports.fooddriveHandler = async event => {
  console.log(JSON.stringify(event, null, 2));
  const parsed = queryString.parse(event.body);
  console.log(JSON.stringify(parsed, null, 2));
  try {
    const command = parsed.text;
    const commandRegex = /(\S+) (\d+) items to team (.+)/;
    const commandData = command.match(commandRegex);
    if (!commandData) {
      if (parsed.text.split(" ")[0] === "leaderboard") {
        await generateLeaderboard(parsed.response_url);
        return {
          statusCode: 200
        };
      }
      console.error("Unable to add items to team", parsed);
      return sendErrorResponse(parsed.response_url);
    }
    if (commandData[1] === "add") {
      const items = Number(commandData[2]);
      const teamName = commandData[3].toUpperCase();
      const team = await getTeam(teamName);
      const total = team.items + items;
      await addItemsToTeam(team, total);
      await axios.post(parsed.response_url, {
        response_type: "in_channel",
        text: `Thanks for the donation, @${parsed.user_name}! Team ${team.name} now has ${total} items!`
      });
    }
    return {
      statusCode: 200
    };
  } catch (e) {
    console.error("Unable to add items to team", e);
    return sendErrorResponse(parsed.response_url);
  }
};
