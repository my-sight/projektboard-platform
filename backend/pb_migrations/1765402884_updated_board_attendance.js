/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3749865384")

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "date1423088652",
    "max": "",
    "min": "",
    "name": "week_start",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3749865384")

  // remove field
  collection.fields.removeById("date1423088652")

  return app.save(collection)
})
