type UserDataType = {
  id: string;
  user_name: string;
  email: string;
  created_at: Date | string;
}

export class UserResponseDTO {
  id: string;
  user_name: string;
  email: string;
  created_at: string;

  constructor(data: UserDataType) {
    this.id = data.id;
    this.user_name = data.user_name;
    this.email = data.email;
    this.created_at = data.created_at instanceof Date ? data.created_at.toISOString() : data.created_at;
  }

  static mapUser(rawDbResult: UserDataType): UserResponseDTO {
    return new UserResponseDTO({
      id: rawDbResult.id,
      user_name: rawDbResult.user_name,
      email: rawDbResult.email,
      created_at: rawDbResult.created_at,
    });
  }
}
