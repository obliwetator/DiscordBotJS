// roleCreate

import { client } from "..";

/* Emitted whenever a role is created.
PARAMETER    TYPE        DESCRIPTION
role         Role        The role that was created    */
client.on("roleCreate", (role) => {
	console.error(`a role is created`);

});

// roleDelete
/* Emitted whenever a guild role is deleted.
PARAMETER    TYPE        DESCRIPTION
role         Role        The role that was deleted    */
client.on("roleDelete", (_role) => {
	console.error(`a guild role is deleted`);
});

// roleUpdate
/* Emitted whenever a guild role is updated.
PARAMETER      TYPE        DESCRIPTION
oldRole        Role        The role before the update
newRole        Role        The role after the update    */
client.on("roleUpdate", (oldRole, newRole) => {
	console.error(`a guild role is updated`);
});