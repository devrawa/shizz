package main

import (
	"net/netip"
	"testing"
)

func TestPublicIP(t *testing.T) {
	for _, ip := range []string{"127.0.0.1", "10.2.3.4", "169.254.169.254", "100.64.0.1", "192.0.2.4", "::1", "::ffff:127.0.0.1", "2001:db8::2", "64:ff9b::a00:1", "224.0.0.1"} {
		if publicIP(netip.MustParseAddr(ip)) {
			t.Errorf("accepted blocked IP %s", ip)
		}
	}
	for _, ip := range []string{"93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"} {
		if !publicIP(netip.MustParseAddr(ip)) {
			t.Errorf("rejected public IP %s", ip)
		}
	}
}

func TestValidateURL(t *testing.T) {
	for _, raw := range []string{"file:///etc/passwd", "http://user:pass@example.com", "http://localhost/", "https://test.local/", "https://example.com:8443/", "https://example.com\\@localhost/"} {
		if _, err := validateURL(raw); err == nil {
			t.Errorf("accepted %s", raw)
		}
	}
	if _, err := validateURL("https://example.com/"); err != nil {
		t.Fatal(err)
	}
}
