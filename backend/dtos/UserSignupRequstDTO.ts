type UserSignupDataType = {
    name:string,
    email:string,
    password:string
}

export class UserSignUpRequest {
    name:string;
    email:string;
    password:string;


    constructor(data:UserSignupDataType){
        this.name = data.name?.trim() || '';
        this.email = data.email?.trim().toLowerCase() || '';
        this.password = data.password || '';
    }
   
}