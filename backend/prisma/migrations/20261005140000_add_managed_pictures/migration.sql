CREATE TABLE "pictures" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "alt_text" TEXT NOT NULL,
    "asset_key" TEXT,
    "storage_key" TEXT,
    "mime_type" TEXT,
    "filename" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "pictures_asset_key_key" ON "pictures"("asset_key");
CREATE UNIQUE INDEX "pictures_storage_key_key" ON "pictures"("storage_key");
CREATE INDEX "pictures_position_idx" ON "pictures"("position");

INSERT INTO "pictures" ("title", "alt_text", "asset_key", "position", "updated_at") VALUES
('Shkermit RTX', 'Shkermit rendered in RTX style', 'img1', 0, CURRENT_TIMESTAMP),
('Shkermit profile picture', 'Shkermit RTX profile picture', 'img2', 1, CURRENT_TIMESTAMP),
('Shkermit portrait', 'Close-up portrait of Shkermit RTX', 'img3', 2, CURRENT_TIMESTAMP),
('Shkermit MLG', 'Shkermit in MLG style', 'img4', 3, CURRENT_TIMESTAMP),
('Shkermit MLG RTX', 'Shkermit in MLG RTX style', 'img5', 4, CURRENT_TIMESTAMP),
('Shkermit Thug', 'Shkermit in thug style', 'img6', 5, CURRENT_TIMESTAMP),
('Shkermit Thug RTX', 'Shkermit in thug RTX style', 'img7', 6, CURRENT_TIMESTAMP),
('Shkermlette', 'Shkermlette character artwork', 'img8', 7, CURRENT_TIMESTAMP),
('Shkermit drinks iced tea', 'Shkermit drinking iced tea', 'img9', 8, CURRENT_TIMESTAMP),
('Shkermit party', 'Shkermit holding a drink', 'img10', 9, CURRENT_TIMESTAMP),
('Shkermit MLG wallpaper', 'Shkermit MLG Thug Life mobile wallpaper', 'img11', 10, CURRENT_TIMESTAMP),
('Old Shkermit', 'Original old Shkermit artwork', 'img12', 11, CURRENT_TIMESTAMP);
