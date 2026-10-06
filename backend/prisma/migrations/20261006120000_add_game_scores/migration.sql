CREATE TABLE "game_scores" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "game" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "game_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "game_scores_user_id_game_mode_key" ON "game_scores"("user_id", "game", "mode");
CREATE INDEX "game_scores_game_mode_score_idx" ON "game_scores"("game", "mode", "score");
