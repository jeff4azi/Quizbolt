import { supabase } from "../supabaseClient";

/**
 * Normalizes a course code string for robust comparison.
 * e.g. "GST 101", "gst101", "GST-101", "GST_101" -> "GST101"
 */
export const normalizeCourseCode = (code) => {
  return String(code || "")
    .replace(/[\s\-_]/g, "")
    .toUpperCase();
};

/**
 * Builds a Set of normalized course identifiers from a list of courses.
 */
export const getActiveCourseCodeSet = (activeCourses = []) => {
  const set = new Set();
  (activeCourses || []).forEach((c) => {
    if (!c) return;
    if (c.id) set.add(normalizeCourseCode(c.id));
    if (c.course_code) set.add(normalizeCourseCode(c.course_code));
    if (c.code) set.add(normalizeCourseCode(c.code));
    if (c.name) set.add(normalizeCourseCode(c.name));
  });
  return set;
};

/**
 * Checks whether a given courseId is present in the activeCourseCodeSet.
 */
export const isCourseInActiveList = (courseId, activeCourseSet) => {
  if (!courseId || !activeCourseSet || activeCourseSet.size === 0) return false;
  return activeCourseSet.has(normalizeCourseCode(courseId));
};

// In-memory cache to prevent redundant fetches during the same session
const activeCoursesCache = new Map();

/**
 * Fetches the active courses for a user profile based on:
 * 1. University's current semester (from `universities` table)
 * 2. User's current level (e.g. 100, 200, 300, 400 from `year`)
 * 3. User's college (filtering out courses not applicable)
 * 4. User's course override enrollments (from `course_enrollments_override`)
 */
export const fetchActiveCoursesForUser = async (profileUser) => {
  if (!profileUser?.university) return [];

  const rawUni = String(profileUser.university).trim();
  const rawYear = parseInt(profileUser.year, 10);
  const level = !isNaN(rawYear)
    ? rawYear < 10
      ? rawYear * 100
      : rawYear
    : 100;
  const userCollege = profileUser.college ? String(profileUser.college).trim().toUpperCase() : null;
  const userId = profileUser.id || null;

  const cacheKey = `${userId || "anon"}_${rawUni.toLowerCase()}_${level}_${userCollege || "none"}`;
  if (activeCoursesCache.has(cacheKey)) {
    return activeCoursesCache.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      // 1. Fetch current semester for the university
      const { data: uniList } = await supabase
        .from("universities")
        .select("id, name, current_semester");

      const matchedUni = (uniList || []).find(
        (u) =>
          u.id?.toLowerCase() === rawUni.toLowerCase() ||
          u.name?.toLowerCase() === rawUni.toLowerCase()
      );

      const currentSemester = matchedUni?.current_semester ?? 1;
      const uniKey = matchedUni?.id || rawUni;

      // 2. Query courses_meta for active semester and level
      let query = supabase
        .from("courses_meta")
        .select("id, course_code, name, title, semester, level, university, colleges, course_group")
        .ilike("university", uniKey)
        .eq("level", level);

      if (currentSemester !== null && currentSemester !== undefined) {
        query = query.eq("semester", currentSemester);
      }

      const { data: coursesData, error: coursesError } = await query;
      if (coursesError) {
        console.error("Error fetching active courses:", coursesError.message);
        return [];
      }

      let activeCourses = coursesData || [];

      // 3. Filter by user's college if available
      if (userCollege) {
        activeCourses = activeCourses.filter((course) => {
          if (!course.colleges || !Array.isArray(course.colleges) || course.colleges.length === 0) {
            return true;
          }
          return (
            course.colleges.some((c) => String(c).trim().toUpperCase() === "ALL") ||
            course.colleges.some((c) => String(c).trim().toUpperCase() === userCollege)
          );
        });
      }

      // 4. Fetch override courses for user if user ID is known
      if (userId) {
        const { data: overrideData, error: overrideError } = await supabase
          .from("course_enrollments_override")
          .select("course_code")
          .eq("user_id", userId);

        if (!overrideError && overrideData && overrideData.length > 0) {
          const overrideCodes = overrideData
            .map((item) => item.course_code)
            .filter(Boolean);

          if (overrideCodes.length > 0) {
            const { data: extraCourses } = await supabase
              .from("courses_meta")
              .select("id, course_code, name, title, semester, level, university, colleges, course_group")
              .ilike("university", uniKey)
              .in("course_code", overrideCodes);

            if (extraCourses) {
              extraCourses.forEach((extra) => {
                const extraNorm = normalizeCourseCode(extra.course_code);
                const alreadyExists = activeCourses.some(
                  (c) => normalizeCourseCode(c.course_code) === extraNorm
                );
                if (!alreadyExists) {
                  activeCourses.push(extra);
                }
              });
            }
          }
        }
      }

      return activeCourses;
    } catch (err) {
      console.error("fetchActiveCoursesForUser exception:", err);
      return [];
    }
  })();

  activeCoursesCache.set(cacheKey, fetchPromise);
  return fetchPromise;
};
