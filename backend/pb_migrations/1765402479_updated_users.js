/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.role = 'admin'",
    "deleteRule": "id = @request.auth.id || @request.auth.role = 'admin'",
    "listRule": "id = @request.auth.id || @request.auth.role = 'admin'",
    "updateRule": "id = @request.auth.id || @request.auth.role = 'admin'",
    "viewRule": "id = @request.auth.id || @request.auth.role = 'admin'"
  }, collection)

  // add field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1466534506",
    "max": 0,
    "min": 0,
    "name": "role",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1337919823",
    "max": 0,
    "min": 0,
    "name": "company",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "hidden": false,
    "id": "bool458715613",
    "name": "is_active",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "createRule": "",
    "deleteRule": "id = @request.auth.id",
    "listRule": "id = @request.auth.id",
    "updateRule": "id = @request.auth.id",
    "viewRule": "id = @request.auth.id"
  }, collection)

  // remove field
  collection.fields.removeById("text1466534506")

  // remove field
  collection.fields.removeById("text1337919823")

  // remove field
  collection.fields.removeById("bool458715613")

  return app.save(collection)
})
