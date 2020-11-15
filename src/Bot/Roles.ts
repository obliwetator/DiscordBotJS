import { client, database } from "..";
// roleCreate
/* Emitted whenever a role is created.
PARAMETER    TYPE        DESCRIPTION
role         Role        The role that was created    */
client.on("roleCreate", (role) => {
	database.AddRoles([role]);

});

// roleDelete
/* Emitted whenever a guild role is deleted.
PARAMETER    TYPE        DESCRIPTION
role         Role        The role that was deleted    */
client.on("roleDelete", (role) => {
	console.error(`a guild role is deleted`);
	database.RemoveRoles(new Set(role.id))
});

// roleUpdate
/* Emitted whenever a guild role is updated.
PARAMETER      TYPE        DESCRIPTION
oldRole        Role        The role before the update
newRole        Role        The role after the update    */
client.on("roleUpdate", (oldRole, newRole) => {
	// Find all affected rows
	const a = client.guilds.cache.get(database.GuildId)!.members.cache.filter(user => user.roles.cache.find(role => role.id === newRole.id)?.id === newRole.id)

	database.UpdateRole(oldRole, newRole);
});