// imports
var bodyParser = require('body-parser');
var express = require("express");
var app = express();
var http = require("http").Server(app);
var mongo = require('mongodb').MongoClient;

// database configuration
var url = "mongodb://localhost:27017/";
var dbName = "chattychat";
var collectionName = "chattychat";

// server configuration
var serverPort = 3000;
var staticDirectory = "\\..\\dist\\Chatty-Chat";

// database objects
var dbServer;
var state;

// state objects
var users;
var usernames;
var groups;
var channels;
var messages;
var id;

// run everything
main();

// FUNCTION DEFINETIONS ------------------------------------------------------------------------------------------------

// setup database, state and server
async function main(){
	
	// connect and setup database
	await setupDatabase();
	
	// initialize the state, either restore from db or save new default
	await initState();
	
	// start srver
	startServer();
}

// connect to database
async function setupDatabase(){

	dbs = await mongo.connect(url);

	// connect to database
	dbServer = dbs
	let db = dbServer.db(dbName);

	// once connected, register on exit signal handler to close db
	process.on('exit', 		exitHandler.bind(null, {cleanup:true}));
	process.on('SIGINT', 	exitHandler.bind(null, {exit:true}));
	process.on('SIGUSR1', 	exitHandler.bind(null, {exit:true}));
	process.on('SIGUSR2', 	exitHandler.bind(null, {exit:true}));
	process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

	// get collections
	state = db.collection(collectionName);
}

// program exit handler, closes database when the program finishes, crashes or is killed
function exitHandler(options, exitCode){

	dbServer.close();
	console.log("Disconnected from database");

	if (options.exit) process.exit();
}

// nitialize a new blank state
async function initState(){

	// default values (superadmin is default user)
	defaultUsers = {
		0:{
			active:		true, 
			superadmin:	true, 
			groupadmin:	true, 
			username:	'super', 
			useremail:	'super@admin.com', 
			password: 	'super',
			color:		0, 
			groups:		{},
		},
	};
	defaultUsernames = {'super':0,};
	defaultGroups = {};
	defaultChannels = {};
	defaultMessages = {};
	defaultId = 1;

	let result = await state.findOne({}, {});

	if(result == null){

		state.insertOne({
			users: 		defaultUsers,
			usernames: 	defaultUsernames,
			groups: 	defaultGroups,
			channels: 	defaultChannels,
			messages: 	defaultMessages,
			id: 		defaultId,
		});

		users = 	defaultUsers;
		usernames = defaultUsernames;
		groups = 	defaultGroups;
		channels = 	defaultChannels;
		messages = 	defaultMessages;
		id = 		defaultId;
		
	} else {
		users = 	result.users;
		usernames = result.usernames;
		groups = 	result.groups;
		channels = 	result.channels;
		messages = 	result.messages;
		id = 		result.id;
	}
	
}

//start server
// sets up server, uses and post request processing
function startServer(){
	// main settings
	app.use(bodyParser.json())
	app.use(express.static(__dirname + staticDirectory));
	app.use("/login", express.static(__dirname + staticDirectory));
	app.use("/dash", express.static(__dirname + staticDirectory));
	app.use(function(req, res, next) {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Headers", "*");
		next();
	});

	// all routes and post requests with the corresponding function 
	app.post("/login", (req, res) => {
		res.send(JSON.stringify(routeLogin(req)));
	});
	app.post("/user", (req, res) => {
		res.send(JSON.stringify(routeUser(req)));
	});
	app.post("/channel", (req, res) => {
		res.send(JSON.stringify(routeChannel(req)));
	});
	app.post("/send-message", (req, res) => {
		res.send(JSON.stringify(routeSendMessage(req)));
	});
	app.post("/new-group", (req, res) => {
		res.send(JSON.stringify(routeNewGroup(req)));
	});
	app.post("/new-channel", (req, res) => {
		res.send(JSON.stringify(routeNewChannel(req)));
	});
	app.post("/delete-group", (req, res) => {
		res.send(JSON.stringify(routeDeleteGroup(req)));
	});
	app.post("/delete-channel", (req, res) => {
		res.send(JSON.stringify(routeDeleteChannel(req)));
	});
	app.post("/new-user", (req, res) => {
		res.send(JSON.stringify(routeNewUser(req)));
	});
	app.post("/manage-group", (req, res) => {
		res.send(JSON.stringify(routeManageGroup(req)));
	});
	app.post("/manage-channel", (req, res) => {
		res.send(JSON.stringify(routeManageChannel(req)));
	});
	app.post("/manage-users", (req, res) => {
		res.send(JSON.stringify(routeManageUsers(req)));
	});
	app.post("/update-group", (req, res) => {
		res.send(JSON.stringify(routeUpdateGroup(req)));
	});
	app.post("/update-channel", (req, res) => {
		res.send(JSON.stringify(routeUpdateChannel(req)));
	});
	app.post("/update-users", (req, res) => {
		res.send(JSON.stringify(routeUpdateUsers(req)));
	});
	
	// begin listening for connections
	http.listen(serverPort);
	console.log("Server started");
}

// proces the login route
// either returns the user id or an error
function routeLogin(req){

	// check if required data is provided
	if(!('username' in req.body && 'password' in req.body))
		return respondInvalidRequest();

	// if the user does not exist, return an error
	let username = req.body.username
	if(!(username in usernames))
		return respondError('User does not exist');
	
	// if the user exists check password
	let userID = usernames[username];
	let password = req.body.password;
	if(password != users[userID].password)
		return respondError('Incorrect password');

	// user is validated
	return respondData(userID);

}

// process the user route
// returns the user data for a given userID and corresponding groups and channels
function routeUser(req){

	// check if required data is provided
	if(!('userID' in req.body))
		return respondInvalidRequest();

	// check if does exists
	if(!(req.body.userID in users))
		return respondError('User does not exist');

	let user = users[req.body.userID];
	let usersGroups = [];

	// if superuser, all groups and channels are returned
	if(user.superadmin){

		// add all groups and their channels
		for(let groupID in groups){

			// add all channels
			let usersChannels = [];
			for(let channelID of groups[groupID].channels){
				usersChannels.push({
					ID:channelID,
					name:channels[channelID].name,
				});
			}

			// add a group object to the list
			usersGroups.push({
				ID:groupID,
				name:groups[groupID].name,
				channels:usersChannels,
			});
		}

	// if normal user or groupadmin return groups and channels they are in
	}else{
		
		// get list of groups from group ID list
		for(let groupID in user.groups){

			// get list of channels from channel ID list
			let usersChannels = [];
			for(let channelID of user.groups[groupID]){

				// channel data initially needed by client
				let channel = channels[channelID];
				usersChannels.push({
					ID:channelID,
					name:channel.name,
				});
			}

			// group data initially needed by client
			let usersGroup = groups[groupID];
			usersGroups.push({
				ID:groupID, 
				name:usersGroup.name,
				channels:usersChannels,
			});
		}
	}

	// compose response
	return respondData({userdata:user, groups:usersGroups});
}

// process the channel route
// returns the channel's participants and messages
function routeChannel(req){

	// check if required data is provided
	if(!('userID' in req.body && 'channelID' in req.body))
		return respondInvalidRequest();

	// check if user exists
	if(!(req.body.userID in users))
		return respondError('User does not exist');

	// check if channel exists
	if(!(req.body.channelID in channels))
		return respondError('Channel does not exist');

	// get list of all the participants
	// get channel participants into client compatible format
	let formattedParticipants = [];
	for(let participant of channels[req.body.channelID].participants){
		formattedParticipants.push({
			username:users[participant].username,
			color:users[participant].color,
			isadmin:users[participant].groupadmin,
		});
	}

	// get messages into client compatible format with aditional data (color, username)
	let formattedMessages = [];
	for(let message of messages[req.body.channelID]){
		let datetime = new Date(message.datetime);
		datetime = datetime.toLocaleTimeString() + " " + datetime.toLocaleDateString();
		formattedMessages.push({
			username:users[message.sender].username,
			content:message.content,
			datetime:datetime,
			color:users[message.sender].color,
		});
	}

	return respondData({participants:formattedParticipants, messages:formattedMessages});
}

// --- prototype ---
// process the send message route
function routeSendMessage(req){

	// check if required data is provided
	if(!('userID' in req.body && 'channelID' in req.body && 'content' in req.body && 'datetime' in req.body))
		return respondInvalidRequest();

	// if user does not exists
	if(!(req.body.userID in users))
		return respondError('User does not exist');
	
	// if channel or messages do not exists
	let channelID = req.body.channelID;
	if(!(channelID in channels && channelID in messages))
		return respondError('Channel does not exist');

	// add message
	let message = {
		sender: req.body.userID,
		content: req.body.content,
		datetime: req.body.datetime,
	}
	messages[channelID].push(message);
	
	saveMessages();
	return respondData(true);
}

// process the new group route
// check permission, creates the group, adds the creator or return error
function routeNewGroup(req){

	// check if required data is provided
	if(!('userID' in req.body && 'name' in req.body))
		return respondInvalidRequest();

	// check if user exists
	let userID = req.body.userID;
	if(!(userID in users))
		return respondError('User does not exist');

	// check if user has permission
	let user = users[userID];
	if(!user.groupadmin && !user.superadmin)
		return respondError('User does not have the necessary permission');

	// generate group, add it to the groups and user and add user to it
	let groupName = req.body.name;
	let groupID = generateID();
	let newGroup = {name:groupName, participants:[userID], channels:[]};
	groups[groupID] = newGroup;
	user.groups[groupID] = [];

	saveUserGroupChannelState();
	return respondData(groupID);
}

// process the new channel route
// check permission, creates the channel, adds the creator and returns feedback
function routeNewChannel(req){

	// check if required data is provided
	if(!('userID' in req.body && 'groupID' in req.body && 'name' in req.body))
		return respondInvalidRequest();

	// check if user exists
	let userID = req.body.userID;
	if(!(userID in users))
		return respondError('User does not exist');

	// check if user has permission
	let user = users[userID];
	if(!user.groupadmin && !user.superadmin)
		return respondError('User does not have the necessary permission');

	// check if groups exists
	let groupID = req.body.groupID;
	if(!(groupID in groups))
		return respondError('Specified group does not exist');

	// generate channel, add it to the group and channels and user
	let channelName = req.body.name;
	let channelID = generateID();
	let newChannel = {group:groupID, name:channelName, participants:[]};
	groups[groupID].channels.push(channelID);
	channels[channelID] = newChannel;
	messages[channelID] = [];
	
	// add user to channel if the user is in the group
	if(groupID in user.groups){
		newChannel.participants.push(userID);
		user.groups[groupID].push(channelID);
	}

	saveUserGroupChannelState();
	saveMessages();
	return respondData(channelID);
}

// process the delete group route
// check permission, delete group from groups and users
function routeDeleteGroup(req){

	// check if required data is provided
	if(!('userID' in req.body && 'groupID' in req.body))
		return respondInvalidRequest();

	// check if user exists
	let userID = req.body.userID;
	if(!(userID in users))
		return respondError('User does not exist');

	// check if user has permission
	let user = users[userID];
	if(!user.groupadmin && !user.superadmin)
		return respondError('User does not have the necessary permission');

	// check if groups exists
	let groupID = req.body.groupID;
	if(!(groupID in groups))
		return respondError('Specified group does not exist');

	// delete group from groups and users
	let group = groups[groupID];
	let groupChannels = group.channels;
	
	// remove channel from channels and message from messages
	for(let channelID of groupChannels){
		delete channels[channelID];
		delete messages[channelID];
	}

	// remove group from users
	for(let participantID of group.participants){
		delete users[participantID].groups[groupID];
	}

	// remove group from groups
	delete groups[groupID];

	saveUserGroupChannelState();
	saveMessages();
	return respondData(true);
}

// process the delete channel route
// check permission, delete group from groups and users
function routeDeleteChannel(req){

	// check if required data is provided
	if(!('userID' in req.body && 'channelID' in req.body))
		return respondInvalidRequest();

	// check if user exists
	let userID = req.body.userID;
	if(!(userID in users))
		return respondError('User does not exist');

	let user = users[userID];

	// check if user has permission
	if(!user.groupadmin && !user.superadmin)
		return respondError('User does not have the necessary permission');

		let channelID = req.body.channelID;

	// check if channel exists
	if(!(channelID in channels))
		return respondError('Specified channel does not exist');

	let channel = channels[channelID];
	let groupID = channel.group;
	let group = groups[groupID];
	
	// remove channel from group
	let index = group.channels.indexOf(channelID);
	group.channels.splice(index, 1);

	// remove channel from users
	for(let participantID of channel.participants){
		let index = users[participantID].groups[groupID].indexOf(channelID);
		users[participantID].groups[groupID].splice(index, 1);
	}

	// remove channel from channel and messages from messages
	delete channels[channelID];
	delete messages[channelID];

	saveUserGroupChannelState();
	saveMessages();
	return respondData(true);
}

// process the new user route
// checks permission, adds new user to users
function routeNewUser(req){

	// check if required data is provided
	if(!('userID' in req.body && 'newUser' in req.body))
		return respondInvalidRequest();

	// check if user exists
	let userID = req.body.userID;
	if(!(userID in users))
		return respondError('Username already exists');

	// check if user has permission
	let user = users[userID];
	if(!user.groupadmin && !user.superadmin)
		return respondError('User does not have the necessary permission');

	//check if user already exists
	let newUser = req.body.newUser;
	if(newUser.username in usernames)
		return respondError('User does not exist');

	// generate user, add it to users
	let newUserID = generateID();
	users[newUserID] = {
		active:true, 
		superadmin:newUser.superadmin, 
		groupadmin:newUser.groupadmin, 
		username:newUser.username, 
		useremail:newUser.useremail, 
		password:newUser.password,
		color:newUser.color, 
		groups:{}};
	usernames[newUser.username] = newUserID;

	saveUserGroupChannelState();
	return respondData(newUserID);
}

// process the manage group route
// check for permission, returns all users, user ids of group
function routeManageGroup(req){

	// check if required data is provided
	if(!('userID' in req.body && 'groupID' in req.body))
		return respondInvalidRequest();

	// check if user exists
	let userID = req.body.userID;
	if(!(userID in users))
		return respondError();

	let user = users[userID];

	// check if user has permission
	if(!user.groupadmin && !user.superadmin)
		return respondError();

	// check if groups exists
	let groupID = req.body.groupID;
	if(!(groupID in groups))
		return respondError();

	// get all users
	let availableUsers = [];
	for(let userID in users){
		let user = users[userID];
		
		// if user is active (not deleted)
		if(user.active){
			availableUsers.push({
				userID:Number(userID),
				username:user.username,
				useremail:user.useremail,
			});
		}
	}

	// get user ids that are in the group
	let selectedIDs = groups[groupID].participants;

	return respondData({availableUsers:availableUsers, selectedIDs:selectedIDs});
}

// process the manage channel route
// check for permission, returns users in group, user ids of channel
function routeManageChannel(req){

	// check if required data is provided
	if(!('userID' in req.body && 'channelID' in req.body))
		return respondInvalidRequest();

	// check if user exists
	let userID = req.body.userID;
	if(!(userID in users))
		return respondError('User does not exist');

	// check if user has permission
	let user = users[userID];
	if(!user.groupadmin && !user.superadmin)
		return respondError('User does not have the necessary permission');

	// check if channel exists
	let channelID = req.body.channelID;
	if(!(channelID in channels))
		return respondError('Specified group does not exist');

	let channel = channels[channelID];
	let groupID = channel.group;
	let group = groups[groupID];

	// get users from group
	let availableUsers = [];
	for(let userID of group.participants){
		let user = users[userID];
		availableUsers.push({
			userID:Number(userID),
			username:user.username,
			useremail:user.useremail,
		});
	}

	// get user ids from the channel
	let selectedIDs = channel.participants;

	return respondData({availableUsers:availableUsers, selectedIDs:selectedIDs});
}

// process the manage users route
// check for permission, return all users, all user ids
function routeManageUsers(req){

	// check if required data is provided
	if(!('userID' in req.body))
		return respondInvalidRequest();

	// check if user exists
	let userID = req.body.userID;
	if(!(userID in users))
		return respondError('User does not exist');

	// check if user has permission
	let user = users[userID];
	if(!user.groupadmin && !user.superadmin)
		return respondError('User does not have the necessary permission');

	// get all users and all user ids
	let availableUsers = [];
	let selectedIDs = [];
	for(let userID in users){
		let user = users[userID];

		// if user is active (not deleted)
		if(user.active){
			availableUsers.push({
				userID:Number(userID),
				username:user.username,
				useremail:user.useremail,
			});
			selectedIDs.push(Number(userID));
		}
	}

	return respondData({availableUsers:availableUsers, selectedIDs:selectedIDs});
}

// process the update group route
// check for permission, adds and removes users accordingly
function routeUpdateGroup(req){

	// check if required data is provided
	if(!('userID' in req.body && 'groupID' in req.body && 'add' in req.body && 'remove' in req.body))
		return respondInvalidRequest();

	// check if user exists
	let userID = req.body.userID;
	if(!(userID in users))
		return respondError('User does not exist');

	// check if user has permission
	let user = users[userID];
	if(!user.groupadmin && !user.superadmin)
		return respondError('User does not have the necessary permission');

	// check if groups exists
	let groupID = req.body.groupID;
	if(!(groupID in groups))
		return respondError('Specified group does not exist');

	let group = groups[groupID];
	let add = req.body.add;
	let remove = req.body.remove;

	// user ids in add are added to the group
	// add users to groups and groups to users
	for(let userID of add){
		users[userID].groups[groupID] = [];
		group.participants.push(userID);
	}

	// user ids in remove are removed from the group
	// remove users from groups and its channels and remove channels and groups from user
	for(let userID of remove){
		// remove user from channels of group
		for(let channelID of users[userID].groups[groupID]){
			let channel = channels[channelID];
			let index = channel.participants.indexOf(userID);
			channel.participants.splice(index, 1);
		}

		// remove user from group
		let index = group.participants.indexOf(userID);
		group.participants.splice(index, 1);

		// remove group and channels from user
		delete users[userID].groups[groupID];
	}

	saveUserGroupChannelState();
	saveMessages();
	return respondData(true);
}

// process the update channel route
// check for permission, adds and removes users accordingly
function routeUpdateChannel(req){

	// check if required data is provided
	if(!('userID' in req.body && 'channelID' in req.body && 'add' in req.body && 'remove' in req.body))
		return respondInvalidRequest();

	// check if user exists
	let userID = req.body.userID;
	if(!(userID in users))
		return respondError();

	// check if user has permission
	let user = users[userID];
	if(!user.groupadmin && !user.superadmin)
		return respondError();

	// check if groups exists
	let channelID = req.body.channelID;
	if(!(channelID in channels))
		return respondError();

	let channel = channels[channelID];
	let groupID = channel.group;
	let add = req.body.add;
	let remove = req.body.remove;

	// user ids in add are added to the channel
	// add users to channels and add channels to users
	for(let userID of add){
		channel.participants.push(userID);
		users[userID].groups[groupID].push(channelID);
	}

	// user ids in remove are removed from the channel
	// remove users from channels and remove channels from users
	for(let userID of remove){
		let i = channel.participants.indexOf(userID);
		channel.participants.splice(i, 1);
		let j = users[userID].groups[groupID].indexOf(channelID);
		users[userID].groups[groupID].splice(j, 1);
	}

	saveUserGroupChannelState();
	saveMessages();
	return respondData(true);
}

// process the update users route
// check for permission, removes users accordingly
// the user iself is deactivated to allow messages to reatain relevant links
// once deactivated a user with the same name can be created again
function routeUpdateUsers(req){

	// check if required data is provided
	if(!('userID' in req.body && 'remove' in req.body))
		return respondInvalidRequest();

	// if user exists
	let userID = req.body.userID;
	if(!(userID in users))
		return respondError('User does not exist');

	// check if user has permission
	let user = users[userID];
	if(!(user.superadmin))
		return respondError('User does not have the necessary permission');

	let remove = req.body.remove;

	// user ids in remove are removed from the system
	// remove users from groups, channels and existance
	for(let userID of remove){
		let user = users[userID];
		let username = user.username;

		// remove user from groups and channels
		for(groupID in user.groups){
			// remove from all channels
			for(channelID of user.groups[groupID]){
				let channel = channels[channelID];
				let index = channel.participants.indexOf(userID);
				channel.participants.splice(index, 1);
			}

			// remove from group
			let group = groups[groupID];
			let index = group.participants.indexOf(userID);
			group.participants.splice(index, 1);
		}

		// remove user
		users[userID].active = false;
		delete usernames[username];
	}

	saveUserGroupChannelState();
	saveMessages();
	return respondData(true);
}

// saves users and usernames to file
function saveUsers(){
	return state.updateOne({}, {$set: {users: users, usernames: usernames}});
}

// saves groups to database
function saveGroups(){
	return state.updateOne({}, {$set: {groups: groups}});
}

// saves channels to database
function saveChannels(){
	return state.updateOne({}, {$set: {channels: channels}});
}

// saves messages to database
function saveMessages(){
	return state.updateOne({}, {$set: {messages: messages}});
}

// saves id counter to database
function saveIDCounter(){
	return state.updateOne({}, {$set: {id: id}});
}

// save users, usernames, groups and channels (for convinience)
function saveUserGroupChannelState(){
	saveUsers();
	saveGroups();
	saveChannels();
}

// error response
function respondError(msg){
	let response = templateResponse();
	response.error = msg;
	return response;
}

// invalid request response, if not the sufficient data was provided
function respondInvalidRequest(){
	return respondError('Invalid request');
}

// data response
function respondData(msg){
	let response = templateResponse();
	response.data = msg;
	return response;
}

// template response, data and/or error is inserted
function templateResponse(){
	return {
		data: null,
		error: null,
	};
}

// generate a new unique ID and return it
function generateID(){
	id++;
	saveIDCounter();
	return id;
}