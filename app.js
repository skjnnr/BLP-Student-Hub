(() => {
  "use strict";

  // ============================================================
  // BLP STUDENT HUB
  // ============================================================

  // PUT YOUR SUPABASE INFORMATION HERE
const SUPABASE_URL = "https://wukwyjtbxqpthbwqhsmg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4SZZm0RQZ48mYYPdEUacyQ_hLZu5FNt";

  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  // ============================================================
  // HELPERS
  // ============================================================

  const $ = (id) => document.getElementById(id);

  function show(element) {
    if (element) {
      element.style.display = "";
    }
  }

  function hide(element) {
    if (element) {
      element.style.display = "none";
    }
  }

  function message(text, error = false) {
    const box = $("authMessage");

    if (!box) return;

    box.textContent = text || "";
    box.style.color = error ? "#dc2626" : "#475569";
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ============================================================
  // STATE
  // ============================================================

  let currentUser = null;
  let currentProfile = null;
  let presenceChannel = null;

  let authMode = "login";
  let loginRole = "student";

  // ============================================================
  // AUTH PAGE
  // ============================================================

  function updateAuthPage() {
    const loginTab = $("loginTab");
    const signupTab = $("signupTab");
    const adminTab = $("adminLoginTab");

    const studentButton = $("studentMode");
    const teacherButton = $("teacherMode");

    const usernameField = $("usernameField");
    const submitButton = $("authSubmit");

    // ----------------------------------------------------------
    // ADMIN LOGIN
    // ----------------------------------------------------------

    if (authMode === "admin-login") {
      if (loginTab) loginTab.className = "secondary";
      if (signupTab) signupTab.className = "secondary";
      if (adminTab) adminTab.className = "primary";

      hide(studentButton);
      hide(teacherButton);
      hide(usernameField);

      if (submitButton) {
        submitButton.textContent = "Administrator Login";
      }

      return;
    }

    // ----------------------------------------------------------
    // CREATE STUDENT ACCOUNT
    // ----------------------------------------------------------

    if (authMode === "signup") {
      if (loginTab) loginTab.className = "secondary";
      if (signupTab) signupTab.className = "primary";
      if (adminTab) adminTab.className = "secondary";

      // Student only
      show(studentButton);
      hide(teacherButton);

      show(usernameField);

      if (studentButton) {
        studentButton.className = "primary";
      }

      if (submitButton) {
        submitButton.textContent = "Create Account";
      }

      return;
    }

    // ----------------------------------------------------------
    // NORMAL LOGIN
    // ----------------------------------------------------------

    if (loginTab) loginTab.className = "primary";
    if (signupTab) signupTab.className = "secondary";
    if (adminTab) adminTab.className = "secondary";

    show(studentButton);
    show(teacherButton);

    hide(usernameField);

    if (loginRole === "student") {
      if (studentButton) studentButton.className = "primary";
      if (teacherButton) teacherButton.className = "secondary";
    } else {
      if (studentButton) studentButton.className = "secondary";
      if (teacherButton) teacherButton.className = "primary";
    }

    if (submitButton) {
      submitButton.textContent = "Login";
    }
  }

  // ============================================================
  // AUTH BUTTONS
  // ============================================================

  function setupAuthButtons() {
    $("loginTab")?.addEventListener("click", () => {
      authMode = "login";
      loginRole = "student";

      message("");
      updateAuthPage();
    });

    $("signupTab")?.addEventListener("click", () => {
      authMode = "signup";
      loginRole = "student";

      message("");
      updateAuthPage();
    });

    $("adminLoginTab")?.addEventListener("click", () => {
      authMode = "admin-login";

      message("");
      updateAuthPage();
    });

    $("studentMode")?.addEventListener("click", () => {
      if (authMode !== "login") return;

      loginRole = "student";

      message("");
      updateAuthPage();
    });

    $("teacherMode")?.addEventListener("click", () => {
      if (authMode !== "login") return;

      loginRole = "teacher";

      message("");
      updateAuthPage();
    });
  }

  // ============================================================
  // AUTH FORM
  // ============================================================

  function setupAuthForm() {
    $("authForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = $("email")?.value.trim();
      const password = $("password")?.value;

      if (!email || !password) {
        message("Please enter your email and password.", true);
        return;
      }

      // ========================================================
      // STUDENT ACCOUNT CREATION
      // ========================================================

      if (authMode === "signup") {
        if (password.length < 6) {
          message(
            "Your password must be at least 6 characters.",
            true
          );
          return;
        }

        message("Creating your account...");

        const { data, error } =
          await supabaseClient.auth.signUp({
            email: email,
            password: password,
          });

        if (error) {
          console.error(error);
          message(error.message, true);
          return;
        }

        // If email confirmation is OFF, Supabase normally gives
        // us a session immediately.
        if (data?.user) {
          currentUser = data.user;

          // The database trigger creates the profile automatically.
          await supabaseClient
            .from("profiles")
            .update({ email: data.user.email || email })
            .eq("id", data.user.id);

          await loadCurrentProfile();

          if (currentProfile) {
            message("Account created successfully!");

            setTimeout(() => {
              showApp();
            }, 500);

            return;
          }
        }

        message(
          "Account created. You can now use the Login button."
        );

        authMode = "login";
        loginRole = "student";
        updateAuthPage();

        return;
      }

      // ========================================================
      // LOGIN
      // ========================================================

      message("Logging in...");

      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password
        });

      if (error) {
        console.error(error);
        message(error.message, true);
        return;
      }

      currentUser = data.user;

      await loadCurrentProfile();

      if (!currentProfile) {
        await supabaseClient.auth.signOut();

        currentUser = null;

        message(
          "Your account profile could not be found.",
          true
        );

        return;
      }

      // ========================================================
      // CHECK ACTIVE
      // ========================================================

      if (currentProfile.active === false) {
        await supabaseClient.auth.signOut();

        currentUser = null;
        currentProfile = null;

        message(
          "This account has been deactivated.",
          true
        );

        return;
      }

      // ========================================================
      // ADMINISTRATOR LOGIN
      // ========================================================

      if (authMode === "admin-login") {
        if (currentProfile.role !== "admin") {
          await supabaseClient.auth.signOut();

          currentUser = null;
          currentProfile = null;

          message(
            "Administrator access denied.",
            true
          );

          return;
        }

        await showApp();
        return;
      }

      // ========================================================
      // TEACHER LOGIN
      // ========================================================

      if (loginRole === "teacher") {
        if (currentProfile.role !== "teacher") {
          await supabaseClient.auth.signOut();

          currentUser = null;
          currentProfile = null;

          message(
            "This account is not a teacher account.",
            true
          );

          return;
        }

        await showApp();
        return;
      }

      // ========================================================
      // STUDENT LOGIN
      // ========================================================

      if (loginRole === "student") {
        if (currentProfile.role !== "student") {
          await supabaseClient.auth.signOut();

          currentUser = null;
          currentProfile = null;

          message(
            "This account is not a student account.",
            true
          );

          return;
        }

        await showApp();
      }
    });
  }

  // ============================================================
  // LOAD CURRENT PROFILE
  // ============================================================

  async function loadCurrentProfile() {
    if (!currentUser) return null;

    const { data, error } =
      await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

    if (error) {
      console.error("Profile error:", error);
      currentProfile = null;
      return null;
    }

    currentProfile = data;

    return data;
  }

  // ============================================================
  // SHOW APP
  // ============================================================

  async function showApp() {
    hide($("auth"));
    show($("app"));

    const displayEmail =
      currentUser?.email ||
      currentProfile?.email ||
      "User";

    if ($("who")) {
      $("who").textContent = displayEmail;
    }

    if ($("welcome")) {
      $("welcome").textContent =
        `Welcome, ${displayEmail}!`;
    }

    if ($("welcomeText")) {
      $("welcomeText").textContent =
        "Welcome to your BLP Student Hub dashboard.";
    }

    // Users management is ADMIN ONLY.
    if ($("usersPanel")) {
      $("usersPanel").style.display =
        currentProfile?.role === "admin" ? "" : "none";
    }

    if ($("roleBadge")) {
      const role = currentProfile?.role;

      if (role === "student") {
        $("roleBadge").textContent = "Student";
      } else if (role === "teacher") {
        $("roleBadge").textContent = "Teacher";
      } else if (role === "admin") {
        $("roleBadge").textContent = "Admin";
      } else {
        $("roleBadge").textContent = "User";
      }
    }

    // Student
    if (currentProfile?.role === "student") {
      
      hide($("usersPanel"));
hide($("usersPanel"));
      hide($("teacherDashboard"));
      hide($("teacherControls"));
      hide($("adminDashboard"));
      hide($("adminControls"));
    }

    // Teacher
    if (currentProfile?.role === "teacher") {
      
      hide($("usersPanel"));
hide($("usersPanel"));
      show($("teacherDashboard"));
      show($("teacherControls"));
      hide($("adminDashboard"));
      hide($("adminControls"));
    }

    // Admin
    if (currentProfile?.role === "admin") {
      
      show($("usersPanel"));
show($("usersPanel"));
      show($("teacherDashboard"));
      show($("teacherControls"));
      show($("adminDashboard"));
      show($("adminControls"));
    }

    await startPresence();
    await loadAnnouncements();
    await loadLinks();

    if (
      currentProfile?.role === "teacher" ||
      currentProfile?.role === "admin"
    ) {
      await loadUsers();
    }
  }


  // ============================================================
  // REALTIME ONLINE MEMBERS
  // ============================================================

  function renderOnlineMembers(state = {}) {
    const membersById = new Map();

    Object.values(state).forEach((presences) => {
      (presences || []).forEach((presence) => {
        if (!presence?.user_id) return;
        membersById.set(presence.user_id, presence);
      });
    });

    const members = [...membersById.values()].filter(
      (member) =>
        member.email &&
        ["admin", "teacher", "student"].includes(member.role)
    );

    if ($("userCount")) {
      $("userCount").textContent = members.length;
    }

    const groups = {
      admin: $("onlineAdmins"),
      teacher: $("onlineTeachers"),
      student: $("onlineStudents")
    };

    const emptyText = {
      admin: "No admins online",
      teacher: "No teachers online",
      student: "No students online"
    };

    Object.entries(groups).forEach(([role, container]) => {
      if (!container) return;

      container.innerHTML = "";

      const roleMembers = members
        .filter((member) => member.role === role)
        .sort((a, b) => a.email.localeCompare(b.email));

      if (roleMembers.length === 0) {
        const empty = document.createElement("div");
        empty.className = "member-placeholder";
        empty.textContent = emptyText[role];
        container.appendChild(empty);
        return;
      }

      roleMembers.forEach((member) => {
        const row = document.createElement("div");
        row.className = "online-member";

        const dot = document.createElement("span");
        dot.className = "online-member-dot";

        const email = document.createElement("span");
        email.className = "online-member-email";
        email.textContent = member.email;

        row.append(dot, email);
        container.appendChild(row);
      });
    });
  }

  async function stopPresence() {
    if (!presenceChannel) {
      renderOnlineMembers({});
      return;
    }

    try {
      await presenceChannel.untrack();
    } catch (error) {
      console.warn("Presence untrack warning:", error);
    }

    try {
      await supabaseClient.removeChannel(presenceChannel);
    } catch (error) {
      console.warn("Presence channel cleanup warning:", error);
    }

    presenceChannel = null;
    renderOnlineMembers({});
  }

  async function startPresence() {
    if (!currentUser || !currentProfile) return;

    await stopPresence();

    presenceChannel = supabaseClient.channel("blp-online-members", {
      config: {
        presence: {
          key: currentUser.id
        }
      }
    });

    presenceChannel.on("presence", { event: "sync" }, () => {
      if (!presenceChannel) return;
      renderOnlineMembers(presenceChannel.presenceState());
    });

    presenceChannel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED" || !presenceChannel) return;

      const result = await presenceChannel.track({
        user_id: currentUser.id,
        email:
          currentUser.email ||
          currentProfile.email ||
          "Unknown user",
        role: currentProfile.role,
        online_at: new Date().toISOString()
      });

      if (result !== "ok") {
        console.error("Could not track online presence:", result);
      }
    });
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  function setupLogout() {
    $("logout")?.addEventListener("click", async () => {
      resetRoleProtectedUI();
      await stopPresence();
      await supabaseClient.auth.signOut();

      currentUser = null;
      currentProfile = null;

      hide($("app"));
      show($("auth"));

      authMode = "login";
      loginRole = "student";

      if ($("authForm")) {
        $("authForm").reset();
      }

      message("");
      updateAuthPage();
    });
  }

  // ============================================================
  // ANNOUNCEMENTS
  // ============================================================

  async function loadAnnouncements() {
    const { data, error } =
      await supabaseClient
        .from("announcements")
        .select("*")
        .order("created_at", {
          ascending: false
        });

    if (error) {
      console.error("Announcement error:", error);
      return;
    }

    const list = $("announcementList");

    if (!list) return;

    list.innerHTML = "";

    if (!data || data.length === 0) {
      list.innerHTML =
        "<p>No announcements yet.</p>";
    } else {
      data.forEach((announcement) => {
        const item = document.createElement("div");

        item.className = "announcement";

        item.innerHTML = `
          <h3>${escapeHTML(announcement.title)}</h3>
          <p>${escapeHTML(
            announcement.content ||
            announcement.text ||
            ""
          )}</p>
        `;

        list.appendChild(item);
      });
    }

    if ($("announcementCount")) {
      $("announcementCount").textContent =
        data?.length || 0;
    }

    if ($("teacherAnnouncementCount")) {
      $("teacherAnnouncementCount").textContent =
        data?.length || 0;
    }
  }

  // ============================================================
  // POST ANNOUNCEMENT
  // ============================================================

  function setupAnnouncementForm() {
    $("postAnnouncement")?.addEventListener(
      "click",
      async () => {
        if (
          !currentProfile ||
          !["teacher", "admin"].includes(
            currentProfile.role
          )
        ) {
          return;
        }

        const title =
          $("announcementTitle")?.value.trim();

        const content =
          $("announcementText")?.value.trim();

        if (!title || !content) {
          alert(
            "Please enter a title and message."
          );
          return;
        }

        const { error } =
          await supabaseClient
            .from("announcements")
            .insert({
              title: title,
              content: content,
              created_by: currentUser.id
            });

        if (error) {
          console.error(error);
          alert(error.message);
          return;
        }

        $("announcementTitle").value = "";
        $("announcementText").value = "";

        await loadAnnouncements();
      }
    );
  }

  // ============================================================
  // LINKS
  // ============================================================

  async function loadLinks() {
    const { data, error } =
      await supabaseClient
        .from("links")
        .select("*")
        .order("created_at", {
          ascending: false
        });

    if (error) {
      console.error("Links error:", error);
      return;
    }

    const list = $("linkList");

    if (!list) return;

    list.innerHTML = "";

    if (!data || data.length === 0) {
      list.innerHTML =
        "<p>No links posted yet.</p>";
    } else {
      data.forEach((link) => {
        const item = document.createElement("div");

        item.className = "link-item";

        let safeUrl = String(link.url || "").trim();

        if (
          !safeUrl.startsWith("http://") &&
          !safeUrl.startsWith("https://")
        ) {
          safeUrl = "https://" + safeUrl;
        }

        item.innerHTML = `
          <a
            href="${escapeHTML(safeUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${escapeHTML(link.title)}
          </a>
        `;

        list.appendChild(item);
      });
    }

    if ($("linkCount")) {
      $("linkCount").textContent =
        data?.length || 0;
    }

    if ($("teacherLinkCount")) {
      $("teacherLinkCount").textContent =
        data?.length || 0;
    }
  }

  // ============================================================
  // POST LINK
  // ============================================================

  function setupLinkForm() {
    $("postLink")?.addEventListener(
      "click",
      async () => {
        if (
          !currentProfile ||
          !["teacher", "admin"].includes(
            currentProfile.role
          )
        ) {
          return;
        }

        const title =
          $("linkTitle")?.value.trim();

        const url =
          $("linkUrl")?.value.trim();

        if (!title || !url) {
          alert(
            "Please enter a link name and URL."
          );
          return;
        }

        let finalUrl = url;

        if (
          !finalUrl.startsWith("http://") &&
          !finalUrl.startsWith("https://")
        ) {
          finalUrl = "https://" + finalUrl;
        }

        const { error } =
          await supabaseClient
            .from("links")
            .insert({
              title: title,
              url: finalUrl,
              created_by: currentUser.id
            });

        if (error) {
          console.error(error);
          alert(error.message);
          return;
        }

        $("linkTitle").value = "";
        $("linkUrl").value = "";

        await loadLinks();
      }
    );
  }

  // ============================================================
  // USERS
  // ============================================================

  async function loadUsers() {
    if (
      !currentProfile ||
      !["teacher", "admin"].includes(
        currentProfile.role
      )
    ) {
      return;
    }

    const { data, error } =
      await supabaseClient
        .from("profiles")
        .select("id, username, email, role, active, created_at")
        .order("created_at", {
          ascending: true
        });

    if (error) {
      console.error("User error:", error);
      return;
    }

    if ($("userCount")) {
      $("userCount").textContent =
        data?.length || 0;
    }

    const list = $("userList");

    if (!list) return;

    list.innerHTML = "";

    if (!data || data.length === 0) {
      list.innerHTML =
        "<p>No users found.</p>";
      return;
    }

    data.forEach((profile) => {
      const item =
        document.createElement("div");

      item.className = "user-item";

      const info =
        document.createElement("div");

      info.innerHTML = `
        <strong>
          ${escapeHTML(
            profile.email || profile.username || "No email available"
          )}
        </strong>

        <span>
          ${escapeHTML(profile.role)}
        </span>

        <small>
          ${profile.active ? "Active" : "Inactive"}
        </small>
      `;

      item.appendChild(info);

      // --------------------------------------------------------
      // TEACHER CONTROLS
      // --------------------------------------------------------

      if (
        currentProfile.role === "teacher" &&
        profile.role === "student" &&
        profile.active
      ) {
        const button =
          document.createElement("button");

        button.textContent = "Deactivate";
        button.className = "secondary";

        button.addEventListener(
          "click",
          () => deactivateStudent(profile.id)
        );

        item.appendChild(button);
      }

      // --------------------------------------------------------
      // ADMIN CONTROLS
      // --------------------------------------------------------

      if (
        currentProfile.role === "admin" &&
        profile.id !== currentUser.id
      ) {
        const select =
          document.createElement("select");

        ["student", "teacher", "admin"]
          .forEach((role) => {
            const option =
              document.createElement("option");

            option.value = role;
            option.textContent =
              role.charAt(0).toUpperCase() +
              role.slice(1);

            if (profile.role === role) {
              option.selected = true;
            }

            select.appendChild(option);
          });

        select.addEventListener(
          "change",
          async () => {
            await changeUserRole(
              profile.id,
              select.value
            );
          }
        );

        item.appendChild(select);

        const statusButton =
          document.createElement("button");

        statusButton.className = "secondary";

        statusButton.textContent =
          profile.active
            ? "Deactivate"
            : "Activate";

        statusButton.addEventListener(
          "click",
          async () => {
            await changeUserStatus(
              profile.id,
              !profile.active
            );
          }
        );

        item.appendChild(statusButton);
      }

      list.appendChild(item);
    });
  }

  // ============================================================
  // DEACTIVATE STUDENT
  // ============================================================

  async function deactivateStudent(userId) {
    if (
      !currentProfile ||
      !["teacher", "admin"].includes(
        currentProfile.role
      )
    ) {
      return;
    }

    if (
      !confirm(
        "Are you sure you want to deactivate this student?"
      )
    ) {
      return;
    }

    const { error } =
      await supabaseClient
        .from("profiles")
        .update({
          active: false
        })
        .eq("id", userId)
        .eq("role", "student");

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    await loadUsers();
  }

  // ============================================================
  // ADMIN CHANGE ROLE
  // ============================================================

  async function changeUserRole(userId, newRole) {
    if (
      !currentProfile ||
      currentProfile.role !== "admin"
    ) {
      return;
    }

    if (
      !["student", "teacher", "admin"]
        .includes(newRole)
    ) {
      return;
    }

    const { error } =
      await supabaseClient
        .from("profiles")
        .update({
          role: newRole
        })
        .eq("id", userId);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    await loadUsers();
  }

  // ============================================================
  // ADMIN CHANGE STATUS
  // ============================================================

  async function changeUserStatus(userId, active) {
    if (
      !currentProfile ||
      currentProfile.role !== "admin"
    ) {
      return;
    }

    const { error } =
      await supabaseClient
        .from("profiles")
        .update({
          active: active
        })
        .eq("id", userId);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    await loadUsers();
  }

  // ============================================================
  // EXISTING SESSION
  // ============================================================

  async function checkExistingSession() {
    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {
      show($("auth"));
      hide($("app"));
      return;
    }

    currentUser = session.user;

    await loadCurrentProfile();

    if (
      !currentProfile ||
      currentProfile.active === false
    ) {
      await supabaseClient.auth.signOut();

      currentUser = null;
      currentProfile = null;

      show($("auth"));
      hide($("app"));

      message(
        "This account is inactive.",
        true
      );

      return;
    }

    await showApp();
  }

  // ============================================================
  // AUTH STATE
  // ============================================================

  function setupAuthState() {
    supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          resetRoleProtectedUI();
          await stopPresence();
          currentUser = null;
          currentProfile = null;

          hide($("app"));
          show($("auth"));

          return;
        }
      }
    );
  }

  // ============================================================
  // START
  // ============================================================

  
  // ============================================================
  // ROLE-PROTECTED UI RESET
  // ============================================================

  function resetRoleProtectedUI() {
    // Always hide privileged UI before a new account/profile is loaded.
    const protectedIds = [
      "usersPanel",
      "userList",
      "teacherDashboard",
      "teacherControls",
      "adminDashboard",
      "adminControls"
    ];

    protectedIds.forEach((id) => {
      const el = $(id);
      if (el) el.style.display = "none";
    });

    // Clear privileged content left over from the previous account.
    if ($("userList")) $("userList").innerHTML = "";

    // Reset role-dependent identity text until the new profile is verified.
    if ($("roleBadge")) $("roleBadge").textContent = "";
  }

async function startApp() {
    resetRoleProtectedUI();
    console.log("BLP Student Hub starting...");

    setupAuthButtons();
    setupAuthForm();
    setupLogout();
    setupAnnouncementForm();
    setupLinkForm();
    setupAuthState();

    updateAuthPage();

    await checkExistingSession();

    console.log("BLP Student Hub loaded.");
  }

  // ============================================================
  // RUN AFTER PAGE LOAD
  // ============================================================

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      startApp
    );
  } else {
    startApp();
  }

})();
