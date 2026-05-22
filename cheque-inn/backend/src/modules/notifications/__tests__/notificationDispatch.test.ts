import * as repo from "../notifications.repository";
import * as usersRepo from "../../users/users.repository";
import { dispatchNotification } from "../notificationDispatch.service";
import { NotificationType } from "../notificationTypes";

jest.mock("../notifications.repository");
jest.mock("../../users/users.repository");
jest.mock("../../../lib/mail/mail.service", () => ({
  sendMailSafe: jest.fn().mockResolvedValue(false),
}));

const mockedRepo = repo as jest.Mocked<typeof repo>;

describe("notificationDispatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips insert when dedupe_key already exists", async () => {
    mockedRepo.existsByDedupeKey.mockResolvedValue(true);

    const result = await dispatchNotification({
      companyId: "c1",
      userId: "u1",
      type: NotificationType.FORGOT_CLOCK_OUT,
      title: "Still clocked in?",
      body: "Check out",
      dedupeKey: "forgot_clock_out:s1",
    });

    expect(result).toBeNull();
    expect(mockedRepo.insertNotification).not.toHaveBeenCalled();
  });

  it("creates notification when dedupe_key is new", async () => {
    mockedRepo.existsByDedupeKey.mockResolvedValue(false);
    mockedRepo.insertNotification.mockResolvedValue({
      id: "n1",
      company_id: "c1",
      user_id: "u1",
      type: NotificationType.LEAVE_APPROVED,
      title: "Approved",
      body: "Your leave was approved",
      read_at: null,
      created_at: new Date().toISOString(),
      metadata: {},
      dedupe_key: "leave:1:approved",
      email_sent_at: null,
      push_sent_at: null,
    });
    (usersRepo.getUserById as jest.Mock).mockResolvedValue({ email: null });

    const result = await dispatchNotification({
      companyId: "c1",
      userId: "u1",
      type: NotificationType.LEAVE_APPROVED,
      title: "Approved",
      body: "Your leave was approved",
      dedupeKey: "leave:1:approved",
    });

    expect(result?.id).toBe("n1");
    expect(mockedRepo.insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupe_key: "leave:1:approved",
      })
    );
  });
});
