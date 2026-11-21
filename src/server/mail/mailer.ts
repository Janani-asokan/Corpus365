export interface Email {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(email: Email): Promise<void>;
}

/** Development mailer: prints emails to the server log instead of sending them. */
class ConsoleMailer implements Mailer {
  async send(email: Email): Promise<void> {
    console.info(`\n[mail] To: ${email.to}\n[mail] Subject: ${email.subject}\n${email.text}\n`);
  }
}

let mailer: Mailer = new ConsoleMailer();

export function getMailer(): Mailer {
  return mailer;
}

export function setMailer(next: Mailer): void {
  mailer = next;
}
