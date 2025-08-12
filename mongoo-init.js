// MongoDB initialization script
// This script runs when the MongoDB container starts for the first time

db = db.getSiblingDB('myapp');

// Create a user for the application
db.createUser({
  user: 'appuser',
  pwd: 'apppassword',
  roles: [
    {
      role: 'readWrite',
      db: 'myapp'
    }
  ]
});

// Create some sample data
db.users.insertMany([
  {
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date()
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    createdAt: new Date()
  }
]);

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: -1 });

print('Database initialized successfully!');
