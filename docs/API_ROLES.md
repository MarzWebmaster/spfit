# API Documentation: Role Management

## Base URL
`/api/roles`

## Endpoints

### 1. Get All Roles
**GET** `/`
- **Description**: Retrieve a list of all roles.
- **Response**:
  ```json
  [
    {
      "id": 1,
      "name": "Admin",
      "description": "Administrator with full access",
      "isSystemRole": true,
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-01T00:00:00.000Z"
    },
    ...
  ]
  ```

### 2. Get Role by ID
**GET** `/:id`
- **Description**: Retrieve details of a specific role.
- **Parameters**: `id` (integer)
- **Response**:
  ```json
  {
    "id": 1,
    "name": "Admin",
    ...
  }
  ```

### 3. Create Role
**POST** `/`
- **Description**: Create a new role.
- **Body**:
  ```json
  {
    "name": "New Role",
    "description": "Description of the role",
    "permissions": ["users.view", "tasks.create"]
  }
  ```
- **Validation**: Name must be unique.

### 4. Update Role
**PUT** `/:id`
- **Description**: Update an existing role.
- **Body**:
  ```json
  {
    "name": "Updated Name",
    "description": "Updated description",
    "permissions": [...]
  }
  ```

### 5. Delete Role
**DELETE** `/:id`
- **Description**: Delete a role.
- **Restrictions**:
  - Cannot delete System roles (Admin, Staff, Supervisor, Freelancer).
  - Cannot delete roles assigned to active users.

## Role Definitions

| Role | Description | Access Level |
|------|-------------|--------------|
| **Admin** | Full system access | Manage users, settings, payments, all tasks. |
| **Staff** | Employee access | Limited to department specific tasks. |
| **Supervisor** | Team management | Manage team members and view reports. |
| **Freelancer** | Project based access | View assigned tasks and manage own profile. |
