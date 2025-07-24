import sqlite3 from 'sqlite3';
sqlite3.verbose();

const db = new sqlite3.Database('./studybuddy.db');

// Create table if not exists
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS progress (
      user_id TEXT,
      topic TEXT,
      score INTEGER,
      date TEXT
    )
  `);
});

export function saveProgress(user_id, topic, score) {
  db.run(
    `INSERT INTO progress (user_id, topic, score, date) VALUES (?, ?, ?, datetime('now'))`,
    [user_id, topic, score],
    (err) => {
      if (err) console.error(err);
    }
  );
}

export function getProgress(user_id, cb) {
  db.all(
    `SELECT * FROM progress WHERE user_id = ? ORDER BY date DESC LIMIT 5`,
    [user_id],
    (err, rows) => {
      if (err) cb([]);
      else cb(rows);
    }
  );
}
