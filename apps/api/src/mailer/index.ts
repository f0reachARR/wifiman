export interface Mailer {
  sendTeamAccessLink(to: string, teamId: string, link: string): Promise<void>;
}
export { createMailer } from './smtp.js';
