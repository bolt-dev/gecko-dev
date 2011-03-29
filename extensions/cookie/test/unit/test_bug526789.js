/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

function do_check_throws(f, result, stack)
{
  if (!stack)
    stack = Components.stack.caller;

  try {
    f();
  } catch (exc) {
    if (exc.result == result)
      return;
    do_throw("expected result " + result + ", caught " + exc, stack);
  }
  do_throw("expected result " + result + ", none thrown", stack);
}

function run_test() {
  var cs = Cc["@mozilla.org/cookieService;1"].getService(Ci.nsICookieService);
  var cm = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
  var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  var expiry = (Date.now() + 1000) * 1000;

  cm.removeAll();

  // Test that 'baz.com' and 'baz.com.' are treated differently
  cm.add("baz.com", "/", "foo", "bar", false, false, true, expiry);
  do_check_eq(cm.countCookiesFromHost("baz.com"), 1);
  do_check_eq(cm.countCookiesFromHost("baz.com."), 0);
  cm.remove("baz.com", "foo", "/", false);
  do_check_eq(cm.countCookiesFromHost("baz.com"), 0);

  cm.add("baz.com.", "/", "foo", "bar", false, false, true, expiry);
  do_check_eq(cm.countCookiesFromHost("baz.com"), 0);
  do_check_eq(cm.countCookiesFromHost("baz.com."), 1);
  cm.remove("baz.com", "foo", "/", false);
  do_check_eq(cm.countCookiesFromHost("baz.com."), 1);
  cm.remove("baz.com.", "foo", "/", false);
  do_check_eq(cm.countCookiesFromHost("baz.com."), 0);

  // Test that setting an empty or '.' http:// host results in a no-op
  var uri = ios.newURI("http://baz.com/", null, null);
  var emptyuri = ios.newURI("http:///", null, null);
  var doturi = ios.newURI("http://./", null, null);
  do_check_eq(uri.asciiHost, "baz.com");
  do_check_eq(emptyuri.asciiHost, "");
  do_check_eq(doturi.asciiHost, ".");
  cs.setCookieString(emptyuri, null, "foo2=bar", null);
  do_check_eq(getCookieCount(), 0);
  cs.setCookieString(doturi, null, "foo3=bar", null);
  do_check_eq(getCookieCount(), 0);
  cs.setCookieString(uri, null, "foo=bar", null);
  do_check_eq(getCookieCount(), 1);

  do_check_eq(cs.getCookieString(uri, null), "foo=bar");
  do_check_eq(cs.getCookieString(emptyuri, null), null);
  do_check_eq(cs.getCookieString(doturi, null), null);

  do_check_eq(cm.countCookiesFromHost("baz.com"), 1);
  do_check_eq(cm.countCookiesFromHost(""), 0);
  do_check_throws(function() {
    cm.countCookiesFromHost(".");
  }, Cr.NS_ERROR_ILLEGAL_VALUE);

  cm.removeAll();

  // Test that an empty file:// host works
  emptyuri = ios.newURI("file:///", null, null);
  do_check_eq(emptyuri.asciiHost, "");
  do_check_eq(ios.newURI("file://./", null, null).asciiHost, "");
  do_check_eq(ios.newURI("file://foo.bar/", null, null).asciiHost, "");
  cs.setCookieString(emptyuri, null, "foo2=bar", null);
  do_check_eq(getCookieCount(), 1);
  cs.setCookieString(emptyuri, null, "foo3=bar; domain=", null);
  do_check_eq(getCookieCount(), 2);
  cs.setCookieString(emptyuri, null, "foo4=bar; domain=.", null);
  do_check_eq(getCookieCount(), 2);
  cs.setCookieString(emptyuri, null, "foo5=bar; domain=bar.com", null);
  do_check_eq(getCookieCount(), 2);

  do_check_eq(cs.getCookieString(emptyuri, null), "foo2=bar; foo3=bar");

  do_check_eq(cm.countCookiesFromHost("baz.com"), 0);
  do_check_eq(cm.countCookiesFromHost(""), 2);

  cm.removeAll();

  // Test that an empty host to add() or remove() works,
  // but a host of '.' doesn't
  cm.add("", "/", "foo2", "bar", false, false, true, expiry);
  do_check_eq(getCookieCount(), 1);
  do_check_throws(function() {
    cm.add(".", "/", "foo3", "bar", false, false, true, expiry);
  }, Cr.NS_ERROR_ILLEGAL_VALUE);
  do_check_eq(getCookieCount(), 1);

  cm.remove("", "foo2", "/", false);
  do_check_eq(getCookieCount(), 0);
  do_check_throws(function() {
    cm.remove(".", "foo3", "/", false);
  }, Cr.NS_ERROR_ILLEGAL_VALUE);

  // Test that the 'domain' attribute accepts a leading dot for IP addresses,
  // aliases such as 'localhost', and eTLD's such as 'co.uk'; but that the
  // resulting cookie is for the exact host only.
  testDomainCookie("http://192.168.0.1/", "192.168.0.1");
  testDomainCookie("http://localhost/", "localhost");
  testDomainCookie("http://co.uk/", "co.uk");

  // Test that trailing dots are treated differently for purposes of the
  // 'domain' attribute when using setCookieString.
  testTrailingDotCookie("http://192.168.0.1", "192.168.0.1");
  testTrailingDotCookie("http://localhost", "localhost");
  testTrailingDotCookie("http://foo.com", "foo.com");

  cm.removeAll();
}

function getCookieCount() {
  var count = 0;
  var cm = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
  var enumerator = cm.enumerator;
  while (enumerator.hasMoreElements()) {
    if (!(enumerator.getNext() instanceof Ci.nsICookie2))
      throw new Error("not a cookie");
    ++count;
  }
  return count;
}

function testDomainCookie(uriString, domain) {
  var cs = Cc["@mozilla.org/cookieService;1"].getService(Ci.nsICookieService);
  var cm = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
  var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

  cm.removeAll();

  var uri = ios.newURI(uriString, null, null);
  cs.setCookieString(uri, null, "foo=bar; domain=" + domain, null);
  do_check_true(cookieExistsForHost(domain));
  do_check_false(cookieExistsForHost("." + domain));
  cm.removeAll();

  cs.setCookieString(uri, null, "foo=bar; domain=." + domain, null);
  do_check_true(cookieExistsForHost(domain));
  do_check_false(cookieExistsForHost("." + domain));
  cm.removeAll();
}

function testTrailingDotCookie(uriString, domain) {
  var cs = Cc["@mozilla.org/cookieService;1"].getService(Ci.nsICookieService);
  var cm = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
  var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

  cm.removeAll();

  var uri = ios.newURI(uriString, null, null);
  cs.setCookieString(uri, null, "foo=bar; domain=" + domain + ".", null);
  do_check_eq(cm.countCookiesFromHost(domain), 0);
  do_check_eq(cm.countCookiesFromHost(domain + "."), 0);
  cm.removeAll();

  uri = ios.newURI(uriString + ".", null, null);
  cs.setCookieString(uri, null, "foo=bar; domain=" + domain, null);
  do_check_eq(cm.countCookiesFromHost(domain), 0);
  do_check_eq(cm.countCookiesFromHost(domain + "."), 0);
  cm.removeAll();
}

// Get a single cookie with a host exactly equal to 'domain'.
function cookieExistsForHost(domain) {
  var result = false;
  var cm = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
  var enumerator = cm.enumerator;
  while (enumerator.hasMoreElements()) {
    var cookie = enumerator.getNext().QueryInterface(Ci.nsICookie2);
    if (cookie.host == domain) {
      do_check_false(result);
      result = true;
    }
  }
  return result;
}

