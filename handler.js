const axios = require("axios");
const queryString = require("query-string");
const DynamoDB = require("aws-sdk/clients/dynamodb");
const dynamoDb = new DynamoDB.DocumentClient();

const addItemsToTeam = async (team, items) => {
  await dynamoDb
    .put({
      TableName: "opi-food-drive",
      Item: {
        id: team,
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
  console.log(data);
  return data.Item;
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

module.exports.fooddriveHandler = async event => {
  console.log(JSON.stringify(event, null, 2));
  const parsed = queryString.parse(event.body);
  console.log(JSON.stringify(parsed, null, 2));
  try {
    const command = parsed.text;
    const commandRegex = /(\S+) (\d+) items to team (.+)/;
    const commandData = command.match(commandRegex);
    console.log(commandData);
    if (!commandData) {
      console.error("Unable to add items to team", parsed);
      return sendErrorResponse(parsed.response_url);
    }
    const items = Number(commandData[2]);
    const teamName = commandData[3].toUpperCase();
    const team = await getTeam(teamName);
    const total = team.items + items;
    await addItemsToTeam(teamName, total);
    await axios.post(parsed.response_url, {
      response_type: "in_channel",
      text: `Thank you for the donation! Team ${commandData[3]} now has ${total} items!`
    });
    return {
      statusCode: 200
    };
  } catch (e) {
    console.error("Unable to add items to team", e);
    return sendErrorResponse(parsed.response_url);
  }
};
