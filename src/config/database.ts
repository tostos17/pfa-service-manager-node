import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();
dns.setDefaultResultOrder('ipv4first');
import { Role } from '../model/Role';
import { User } from '../model/User';
import { Parent } from '../model/Parent';
import { Coach } from '../model/Coach';
import { Director } from '../model/Director';
import { Admin } from '../model/Admin';
import { Player } from '../model/Player';
import { PlayerProfile } from '../model/PlayerProfile';
import { Account } from '../model/Account';
import { Category } from '../model/Category';
import { Session } from '../model/Session';
import { Term } from '../model/Term';
import { Invoice } from '../model/Invoice';
import { Payment } from '../model/Payment';
import { PaymentAllocation } from '../model/PaymentAllocation';
import { InvoicePayment } from '../model/InvoicePayment';
import { AttendanceEvent } from '../model/AttendanceEvent';
import { PlayerAttendanceLine } from '../model/PlayerAttendanceLine';
import { AcademyExpense } from '../model/AcademyExpense';
import { InformationHub } from '../model/InformationHub';
import { Match } from '../model/Match';
import { MatchEvent } from '../model/MatchEvent';
import { MatchStateEvent } from '../model/MatchStateEvent';
import { FreekickEvent } from '../model/FreekickEvent';
import { CardEvent } from '../model/CardEvent';
import { CornerEvent } from '../model/CornerEvent';
import { Goal } from '../model/Goal';
import { Substitution } from '../model/Substitution';
import { MatchPhoto } from '../model/MatchPhoto';
import { MatchVideo } from '../model/MatchVideo';
import { TrainingSession } from '../model/TrainingSession';
import { TrainingAttendance } from '../model/TrainingAttendance';

import { DataSourceOptions } from 'typeorm';

const entities = [
    Role, User, Parent, Coach, Director, Admin, Player, PlayerProfile, Category, Account,
    Session, Term, Invoice, Payment, PaymentAllocation, InvoicePayment,
    AttendanceEvent, PlayerAttendanceLine, AcademyExpense, InformationHub,
    Match, MatchEvent, MatchStateEvent, FreekickEvent, CardEvent, CornerEvent,
    Goal, Substitution, MatchPhoto, MatchVideo, TrainingSession, TrainingAttendance
];

const connectionOptions: DataSourceOptions = process.env.DATABASE_URL
    ? {
          type: 'postgres',
          url: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          synchronize: false,
          logging: false,
          entities,
          migrations: [],
          subscribers: [],
          extra: {
              lookup: (hostname: string, options: any, callback: any) => {
                  dns.lookup(hostname, { family: 4 }, callback);
              }
          }
      }
    : {
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USERNAME || 'admin',
          password: process.env.DB_PASSWORD || 'password',
          database: process.env.DB_NAME || 'mydatabase',
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
          synchronize: false,
          logging: false,
          entities,
          migrations: [],
          subscribers: []
      };

export const AppDataSource = new DataSource(connectionOptions);
