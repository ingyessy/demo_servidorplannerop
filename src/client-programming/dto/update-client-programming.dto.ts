import { PartialType } from '@nestjs/swagger';
import { CreateClientProgrammingDto } from './create-client-programming.dto';

export class UpdateClientProgrammingDto extends PartialType(CreateClientProgrammingDto) {}
